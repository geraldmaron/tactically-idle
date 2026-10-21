import type { CallTree, TreeChoice, TreeIf, TreeNext, TreeOutcome, TreeState, TreeTimeout } from './types';

// Going Live, the first curated call (design sheet: docs/calls/going-live-design.md). A delivery
// rider {delivery_app} cut off over a stolen order holds the night manager at the pickup counter of
// {place} and streams it on {stream_app}. The rider wants one sentence said on camera: that the
// rider didn't take the order. The stream is the rider's shield and the rider's trap. Every viewer
// makes it safer to stay and harder to back down.
//
// Hidden truth: who took the order (rider_clear), and whether being refused on camera turns the
// handgun on the manager (raised). Each situation reframes a scene the player has already watched:
// in the first, the clerk took the bag and the manager, the clerk's uncle or aunt, blamed the rider to
// keep the clerk's job, so the manager's glances at the stockroom door were never about the handgun;
// in the second, the rider took it, and the four hundred people who believe otherwise are the reason
// the rider can't stop. A rider past breaking point (meters) can turn the handgun anyway in stage 3.
//
// Pressure source (src/content/incidents/hostage.ts): the stream's count. Talking on the stream
// feeds it; cutting it costs the rider's trust; turning the camera to the wall slows it. The news
// arrives through the stream's own events (the {outlet} repost cue, the van on the threats). The
// beats on each threat are what the scene says while the player decides.
//
// Self-harm screen (E4): applies to the rider. Cut off from the only income, accused in public, a
// handgun, a refusal. No path shows the rider's death (noDeathOnCard, force noFatal); the negotiator
// asks the direct question off the card. The 988 line shows in the debrief.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const ASK = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
/** Leverage on the rider: taking something away to make them talk. The bigger the audience, the
 * harder it is to take (the stream's odds pull reads contact and pressure). */
const PRESS = { kind: 'pressure', ratings: [{ key: 'composure', weight: 0.5 }, { key: 'coordination', weight: 0.5 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
const check = (base: typeof TALK | typeof HOLD | typeof ASK | typeof MOVE | typeof PRESS | typeof ENTER, difficulty = 0): TreeChoice['check'] =>
  ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

const RAISED: TreeIf = { fact: 'raised', is: true };
const CALM: TreeIf = { fact: 'raised', is: false };
const BREAKING: TreeIf = { meter: 'rider', stance: 'breaking' };
const HOLDING: TreeIf = { meter: 'rider', stance: 'breaking', is: false };
const CLEAR: TreeIf = { fact: 'rider_clear', is: true };
const TOOK: TreeIf = { fact: 'rider_clear', is: false };

/** A crisis negotiator on the call: talk that turns on the words goes better. */
const NEGOTIATOR = { cert: 'crisis_negotiation', value: 6, label: 'Negotiation training' } as const;
/** A surveillance officer moves the squad up where the rider won't see it. */
const SURVEILLANCE = { cert: 'surveillance', value: 6, label: 'Surveillance training' } as const;
/** A steady officer doesn't speed up for the camera (content/traits.ts). */
const STEADY_ON_CAMERA = { trait: 'steady' as const, value: 4, label: 'doesn’t speed up for the camera' };
const CALM_ON_CAMERA = { trait: 'calm_voice' as const, value: 3, label: 'sounds the same to two thousand strangers' };

/** An adverse result that provokes the rider. `lead` is said either way, with `extra`; then the
 * truth decides whether the handgun comes up at the manager. With `anyway`, a stage 3 fork: a rider
 * past breaking point does it even when the truth says no. */
function escalate(opts: { lead: string; threat: string; anyway?: string; quiet: string; quietNext?: TreeNext; extra?: Partial<TreeOutcome> }): TreeOutcome[] {
  const { lead, threat, anyway, quiet, quietNext = { node: 'off_air' }, extra = {} } = opts;
  const out: TreeOutcome[] = [{ ...extra, text: lead }, { if: RAISED, text: threat, reveal: ['raised'], next: { node: 'threat' } }];
  if (!anyway) return [...out, { if: CALM, text: quiet, reveal: ['raised'], next: quietNext }];
  return [...out,
    { if: [CALM, BREAKING], text: anyway, mark: ['turned'], next: { node: 'threat' } },
    { if: [CALM, HOLDING], text: quiet, reveal: ['raised'], next: quietNext }];
}

/** The clerk goes out with the manager while still inside. */
const clerkToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['clerk'] }, text, safe: ['clerk'], ...extra });

/** The call ends with the manager still inside: the lead line, a line while the clerk is inside, and
 * the ending by who is left. `also` are truth or meter conditions and `state` the public state the
 * band puts on the held branch; both reach every row after the lead. */
const heldEnd = (lead: TreeOutcome, clerkLine: string, also: TreeIf[] = [], state: TreeState = {}): TreeOutcome[] => {
  const iff = also.length ? { if: also } : {};
  const clerkIn = { ...state, notSafe: [...state.notSafe ?? [], 'clerk'] };
  const clerkOut = { ...state, safe: [...state.safe ?? [], 'clerk'] };
  return [
    lead,
    { ...iff, when: clerkIn, text: clerkLine },
    { ...iff, when: clerkOut, text: '', next: { ending: 'held_counter' } },
    { ...iff, when: clerkIn, text: '', next: { ending: 'held_both' } },
  ];
};
const MANAGER_IN: TreeState = { notSafe: ['manager'] };
const ON_STREAM: TreeState = { notMarks: ['cut', 'stream_off'] }, STREAM_CUT: TreeState = { marks: ['cut'] }, STREAM_ENDED: TreeState = { marks: ['stream_off'], notMarks: ['cut'] }; // the stream running, cut by command, or ended by the rider

/** A stage 3 moment run out with no choice made (owner 2026-10-21): command takes the street and
 * holds it, and the held ending names who is still inside. */
const holdTheNight = (text: string): TreeTimeout => ({ text, next: { ending: 'rider_held' },
  nextIf: [{ when: { notSafe: ['manager', 'clerk'] }, next: { ending: 'held_both' } }, { when: MANAGER_IN, next: { ending: 'held_counter' } }] });

/** The lie (dilemma pattern 15): the team told the rider the clerk backs the rider's story. When it
 * isn't true, the rider hears that on the stream, from the clerk's own phone. */
const foundOut = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { marks: ['lied_clerk'] }, breaks: ['clerk_backs'], mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 12 }, text, ...extra });

export const HOSTAGE_LIVE: CallTree = {
  type: 'hostage_crisis',
  title: 'Going Live',
  roles: [
    { id: 'rider', label: 'delivery rider', pronouns: 'he', kind: 'subject',
      profile: '{rider.first} picked up from {place} five nights a week for two years. {delivery_app} cut {rider.him} off on Tuesday over an order that never arrived. {rider.His} {stream_app} channel has four hundred followers, most of them other riders, and {rider.he} {rider~posts|post} to it from a phone mount on the handlebars.',
      carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'handgun' } },
    { id: 'manager', label: 'night manager', pronouns: 'she', kind: 'civilian',
      profile: '{manager.first} has run the night shift at {place} for six years and filed the complaint that got {rider.first} cut off. Every pickup time on the whiteboard by the register is in {manager.his} handwriting.' },
    { id: 'clerk', label: 'clerk', pronouns: 'he', kind: 'civilian',
      profile: '{clerk.first} is nineteen and stocks the coolers on the night shift. {manager.first} got {clerk.him} the job. {clerk.He} worked the register the night the order went missing.' },
    { id: 'friend', label: 'rider friend', pronouns: 'he', kind: 'bystander', place: 'outside',
      profile: '{friend.first} rides the same zone as {rider.first} and came straight from a drop when the stream started. {friend.He} {friend~stands|stand} at the patrol line with {friend.his} delivery bag on {friend.his} back, typing into the comments.' },
  ],
  // A pickup counter: a shop floor, a sales floor or a bar.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 2, timeOfDay: 'night' },
  summary: '{rider.first} wants one sentence said on {rider.his} stream. The night manager is on the floor behind the counter, and {rider.first} has a handgun.',
  coldOpen: 'On Tuesday {delivery_app} sent {rider.first} one line. Account deactivated after a customer complaint. The complaint came from {place}. It said {rider.first} picked up an order at 11:40 that never reached the door it was paid for. {rider.first} stopped riding after that. Tonight {rider.he} walked in at the end of the shift, propped {rider.his} phone against the register with the stream running and asked {manager.first} to say {rider.he} didn’t take the bag. {manager.first} said no. {rider.first} took a handgun out of {rider.his} jacket. {clerk.first} was coming out of the stockroom with a case of water and stopped in the doorway.',
  pressureLabel: '{manager.first} on camera',
  pressure: { start: 18, perMinute: 0.15, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{clerk.first} called 911 from the stockroom, keeping {clerk.his} voice down. A rider the store got cut off is back with a handgun and won’t let {manager.first} or {clerk.first} leave.',
    known: [
      '{clerk.first} told the dispatcher, “{rider.He} {rider~wants|want} {manager.first} to say it on the stream.”',
      'Patrol counts more than four hundred people watching {rider.first}’s stream on {stream_app}.',
      '{clerk.first} says {manager.first} is sitting on the floor behind the register, out of frame.',
      'The store’s complaint says the order was picked up at 11:40 and never delivered.',
    ],
    unknown: ['Who took the bag'],
    responsibilities: ['Get {manager.first} and {clerk.first} out', 'Bring {rider.first} out alive'],
  },
  stageLabels: { assess: 'On the stream', adapt: 'The bag', resolve: 'Way out' },
  objectives: [
    { id: 'clerk', label: 'Get {clerk.first} out' },
    { id: 'manager', label: 'Get {manager.first} out' },
    { id: 'rider', label: 'Bring {rider.first} out alive' },
  ],
  // A rider past breaking point who turns on the manager although the truth said otherwise: a threat
  // to life the team saw, so command can approve going in (sim/authorization.ts).
  threatMarks: { turned: '{rider.first} turned the handgun on {manager.first}', shot_inside: '{rider.first} fired a shot inside' },
  facts: {
    handgun: { public: true, source: 'Responding patrol', truth: true, label: 'Patrol’s handgun report',
      claim: 'Patrol says {rider.first} is holding a handgun on the people inside.',
      confirmed: 'The team saw the handgun in {rider.first}’s hand on the stream.', disproved: 'The team could not see a handgun.' },
    rider_clear: { label: 'Who took the bag', claim: 'Who took the missing bag.',
      confirmed: '{clerk.first} took the bag before {rider.first} arrived for it, and {manager.first} knew.', disproved: '{rider.first} picked up the bag at 11:40, kept it when the drop failed and marked it delivered.' },
    raised: { label: 'The view of the counter', claim: 'What the stream shows when {rider.first} is refused on camera.',
      confirmed: 'The stream showed {rider.first} point the handgun at {manager.first}.', disproved: 'On the stream, {rider.first} walks the length of the counter with the handgun at {rider.his} side.',
      threat: '{rider.first} pointed the handgun at {manager.first}' },
  },
  situations: [
    { note: '{rider.He} didn’t take the bag. {clerk.first} did, and {manager.first}, who got {clerk.first} the job, filed the complaint against {rider.first} to keep {clerk.him} in it. A refusal leaves {rider.first} pacing.', truth: { rider_clear: true, raised: false }, descriptors: ['suicide_self_harm', 'injury', 'police_gunfire'] },
    { note: '{rider.He} picked up the bag at 11:40, kept it when the drop failed, marked it delivered and told the stream otherwise. Four hundred people believe {rider.him}. A refusal on camera turns the handgun on {manager.first}.', truth: { rider_clear: false, raised: true }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
  ],
  turns: { clerk_out: ['clerk_talks'] },
  difficulty: { base: 36, perTier: 4 },
  root: 'going_live',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'going_live', stage: 'assess',
      // The address threat: a named commenter posts where the store is. The beats are the comments
      // closing in on it, read out by the rider, so the countdown is the guess getting warmer.
      threat: { label: 'Address posted by {handle}', minutes: 11, text: 'The street address of {place} shows up in the comments, posted by {handle}. {rider.first} reads the address out loud. Shares push the count up, and patrol starts turning cars away at the corner.', pressure: 4, bump: { stream: 10 },
        beats: [
          { id: 'where_is_this', at: 1.2, by: 'rider', line: 'Somebody called {handle} wants to know where this is. Should I tell them?', bump: { stream: 4 } },
          { id: 'manager_low', at: 3.4, by: 'manager', line: 'Those people don’t pay your rent, {rider.first}.', moves: { rider: 'provoked' }, bump: { stream: 5 } },
          { id: 'cross_streets', at: 6.8, by: 'radio', line: 'Comments guessing cross streets. One is right.', bump: { stream: 6 } },
        ],
        timeout: { text: 'The register phone stays silent. {rider.first} stops waiting for the police and asks the comments what to do.', next: { node: 'address_out' } } },
      prompt: 'The negotiator’s callback rings beside the register, and {rider.first} lets it ring with the stream running. {manager.first} sits on the floor by the drinks cooler. {manager.His} eyes go to the stockroom door, where {clerk.first} is standing, and not to the handgun.',
      exchange: [{ by: 'rider', line: 'Four hundred people know I didn’t take the bag.' }, { by: 'radio', line: 'Callback ringing. Subject at counter, handgun out.' }],
      choices: [
        { id: 'on_stream', title: 'Talk to {rider.him} on the stream', icon: 'radio', talksTo: 'rider', check: check(TALK), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} calls back. You are on speaker, live through the phone on the register. {rider.first} answers this way or not at all. While you talk, the count climbs, and so does the number of people {rider.he} can’t back down in front of.',
          pull: '{rider.first} is picking up on this line right now.',
          cost: 'Four hundred strangers hear every question you ask.',
          preview: { favorable: '{rider.first} tells you what {rider.he} came for, out loud.', mixed: '{rider.first} answers the comments instead of you.', adverse: '{rider.first} turns the camera on {manager.first}, the handgun in {rider.his} other hand.' },
          outcomes: {
            favorable: [{ text: '{rider.first} answers the negotiator facing the phone, not the window. At 11:40, {rider.he} {rider~says|say}, {rider.he} {rider~was|were} at a red light two blocks away, and {delivery_app} has the timestamp. {rider.He} {rider~says|say} {rider.he} will walk out once {manager.first} says it on camera.',
              exchange: [{ by: 'rider', line: 'One sentence. Then I walk.' }], mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'on_air' }, objective: 15 }],
            mixed: [{ text: '{rider.first} reads each question to the comments and answers them, not the negotiator. A rider in the chat types that the police are stalling, and {rider.first} asks the negotiator if that’s true.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 14 }, next: { node: 'on_air' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} lifts the phone off the register and holds the camera on {manager.first}’s face while the negotiator talks.',
              threat: '{rider.first} brings the handgun down beside the phone, pointed at {manager.first}, and the stream shows both.',
              quiet: '{rider.first} hangs up mid-question and goes on talking to the viewers, back to the window.',
              quietNext: { node: 'on_air' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 16 }, pressure: 8 } }),
          } },
        { id: 'clerk_out', title: 'Get {clerk.first} out the back', icon: 'door', walks: 'clerk', team: { to: 'escort' }, check: check(MOVE, -4), minutes: 4, consequenceLevel: 'moderate',
          summary: 'The camera faces the counter, so {lead} takes two officers in through the back to walk {clerk.first} out of the stockroom. If the door moves on the stream, {rider.first} hears about it from strangers.',
          pull: '{clerk.first} is nineteen and a few steps from the back door.',
          cost: 'The comments may spot the stockroom door before {rider.first} does.',
          preview: { favorable: '{clerk.first} walks out the back unseen.', mixed: '{clerk.first} is out, but the door swings in the corner of the picture.', adverse: '{clerk.first} freezes in the doorway on camera, and {rider.first} fires a shot.' },
          outcomes: {
            favorable: [{ text: '{clerk.first} sets the case of water down on the stockroom floor and walks out the back between two officers. Behind the patrol car {clerk.he} {clerk~asks|ask} for {clerk.his} phone back.',
              exchange: [{ by: 'clerk', line: 'I didn’t say anything to anybody. I didn’t.' }], safe: ['clerk'], next: { turn: 'clerk_out' }, objective: 30, pressure: -3 }],
            mixed: [{ text: '{clerk.first} gets out, but the stockroom door swings shut in the corner of the stream. The comments catch the door first. {rider.first} reads them out and turns to face the stockroom.',
              safe: ['clerk'], mark: ['seen_back'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { turn: 'clerk_out' }, objective: 25, pressure: 4 }],
            adverse: [{ text: '{clerk.first} gets one step past the doorway and stops in the middle of the picture. {rider.first} sees {clerk.him} on the phone screen first, then turns. {rider.He} {rider~fires|fire} into the ceiling tiles, and {clerk.first} drops to the tile where {clerk.he} {clerk~stands|stand}.',
              mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'threat' }, pressure: 14, civilian: -6 },
              { text: 'A light panel comes down with the tiles and breaks on the floor beside {clerk.first}.' }],
          } },
        { id: 'watch_feed', title: 'Watch the counter before you answer', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(ASK), minutes: 3, consequenceLevel: 'moderate',
          certBonus: SURVEILLANCE,
          summary: 'Let the callback ring out while your squad watches the counter from the corner, through the glass, with the stream open on a tablet. The glass shows what the camera misses.',
          pull: 'Find out who looks where before you say a word.',
          cost: 'The register phone rings out while the comments ask why you haven’t answered.',
          preview: { favorable: 'You see where the handgun points and who {manager.first} keeps looking at.', mixed: 'The chat sees police at the corner while you watch.', adverse: 'If {rider.first} takes the ringing as an answer, the handgun comes up at {manager.first}.' },
          outcomes: {
            favorable: [
              { text: 'From the corner the team watches the counter through the glass and on the tablet at once. The handgun is in {rider.first}’s right hand, pointed at the floor. {manager.first} looks at {clerk.first} in the stockroom doorway, then away, each time {rider.first} turns.',
                reveal: ['handgun'], mark: ['glance', 'looked'], moves: { rider: 'contact' }, next: { node: 'on_air' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'The lead officer can read the pickup whiteboard by the register. One time on it has been rubbed out.' },
            ],
            mixed: [{ text: 'The team gets a clear look at the counter and the handgun. So does the chat, which spots a helmet at the corner behind the picture. {rider.first} turns the phone toward the street and asks the police to wave.',
              reveal: ['handgun'], mark: ['performing', 'looked'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 4, pressure: 4 }],
            adverse: escalate({
              lead: 'The callback rings out on the stream. {rider.first} tells the viewers that was the police’s answer.',
              threat: '{rider.first} raises the handgun at {manager.first} and tells the camera the police had their chance.',
              quiet: '{rider.first} switches off the ringer and talks to the comments instead.',
              quietNext: { node: 'on_air' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the stream is up
    { id: 'on_air', stage: 'adapt',
      threat: { label: 'The comments turn', minutes: 11, text: 'The comments turn. Viewers ask why {rider.first} needs a handgun if {rider.he} didn’t take anything, and {rider.first} argues with each of them out loud.', pressure: 5, mark: ['turned_chat'], moves: { rider: 'provoked' }, bump: { stream: 10 },
        beats: [
          { id: 'friend_types', at: 1.4, by: 'rider', line: '{friend.first} says come out, I got you. {friend.first}, I can’t.' },
          { id: 'count_two', at: 2.8, by: 'radio', line: 'Stream over two thousand. {outlet_short} van two blocks out.', bump: { stream: 6 } },
          { id: 'manager_asks', at: 3.9, by: 'manager', line: 'Can I stand up? My knees, {rider.first}.', moves: { rider: 'contact' } },
        ],
        timeout: { text: 'The police say nothing to the chat while it turns. {rider.first} tells the chat the police have nothing to say.', next: { node: 'chat_turned' } } },
      prompt: 'The count under the picture has passed a thousand. {rider.first} stands between the camera and {manager.first}, close enough to reach the screen, and wants {manager.first} to say one sentence into the phone.',
      exchange: [{ by: 'rider', line: 'Tell them. Tell them what you told {delivery_app}.' }, { by: 'manager', line: 'Not with that in your hand.' }],
      promptIf: [
        { when: { marks: ['terms'] }, prompt: '{rider.first} has told the stream what ends this. One sentence from {manager.first}, and {rider.he} {rider~walks|walk} out. {manager.first} hasn’t spoken since.' },
        { when: { marks: ['glance'] }, prompt: 'On the tablet the count passes a thousand. Through the glass, {manager.first} looks at the stockroom door again.' },
      ],
      choices: [
        { id: 'manager_speaks', title: 'Let {manager.first} answer on camera', icon: 'radio', talksTo: 'manager', check: check(TALK, 4), minutes: 3, consequenceLevel: 'high',
          modifiers: [{ label: 'You saw who {manager.he} {manager~watches|watch}', mark: 'glance', value: 6 }],
          summary: 'Ask {rider.first} to let {manager.first} stand up and answer on the stream, now. You don’t know what {manager.first} will say. Everyone watching hears it when you do, while {rider.first} holds the handgun.',
          pull: '{rider.first} hears {manager.first} answer for {manager.himself}.',
          cost: 'You can’t take back a word {manager.first} says on camera.',
          preview: { favorable: '{manager.first} answers straight, and what {manager.he} {manager~says|say} decides where this goes.', mixed: '{manager.first} starts to answer and {rider.first} cuts {manager.him} off.', adverse: '{manager.first} says the wrong thing on camera, and {rider.first} may aim the handgun at {manager.him}.' },
          outcomes: {
            favorable: [
              { if: CLEAR, text: '{manager.first} pulls up on the cooler handle and faces the phone. {manager.He} {manager~says|say} it fast, then {manager~looks|look} at the stockroom door, and the stream sees where {manager.he} {manager~looks|look}.',
                exchange: [{ by: 'manager', line: 'You didn’t take it. I knew you didn’t.' }], reveal: ['rider_clear'], mark: ['admitted'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -6 },
              { if: TOOK, text: '{manager.first} stands, holding the cooler door, and talks to the camera instead of to {rider.first}. The comments stop. Then they start again, faster than {rider.first} can read, and most of them say {rider.he} took the bag.',
                exchange: [{ by: 'manager', line: 'You picked it up at 11:40. It’s on the camera.' }], reveal: ['rider_clear'], mark: ['exposed'], moves: { rider: 'provoked' }, bump: { stream: 15 }, next: { node: 'cornered' }, objective: 10 },
            ],
            mixed: [{ text: '{manager.first} gets as far as {rider.first}’s name before {rider.first} talks over {manager.him}. {rider.He} {rider~tells|tell} the camera about the red light and the timestamp, and {rider~says|say} {manager.first} will say it standing up or not at all.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: '{manager.first} stands up and says into the phone that {rider.first} is a coward with a handgun.',
              threat: '{rider.first} brings the handgun up level with {manager.first}’s chest, in full view of the stream.',
              quiet: '{rider.first} pushes {manager.first} back down to the floor and points the camera at {manager.him}.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 18 }, pressure: 10 } }),
          } },
        { id: 'camera_wall', title: 'Ask {rider.him} to turn the camera to the wall', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} asks {rider.first} to face the phone toward the wall and leave the sound on, so viewers hear everything and see nothing. {rider.first} has to trust a police voice over the strangers who believe {rider.him}, and they will watch the picture go to plaster.',
          pull: 'Fewer people join a stream that shows a wall.',
          cost: '{rider.first} gives up the witnesses {rider.he} came here for, on your word.',
          preview: { favorable: '{rider.first} faces the phone at the wall and answers you.', mixed: 'The phone turns away, then back when the comments complain.', adverse: '{rider.first} refuses on camera, with the handgun a step from {manager.first}.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} turns the phone to face the wall by the register, with the sound on. The comments keep scrolling, and nobody reads them out. {rider.first} starts answering the negotiator instead.',
                mark: ['phone_wall'], moves: { rider: 'contact' }, next: { node: 'way_out' }, objective: 15, pressure: -5 },
              { when: { lead: ['steady'] }, text: 'The negotiator keeps the same even pace through the noise from the speaker.' },
            ],
            mixed: [{ text: '{rider.first} turns the phone to the wall, then picks the phone up to check the comments and turns the camera back toward the counter.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 6 }, next: { node: 'way_out' }, objective: 6 }],
            adverse: escalate({
              lead: '{rider.first} tells the camera the police want to take the viewers away too, after {delivery_app} took the job.',
              threat: 'Then {rider.he} {rider~points|point} the handgun at {manager.first} and {rider~asks|ask} the stream what happens now.',
              quiet: '{rider.first} props the phone higher on the register to take in more of the room.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
          } },
        // Command can end the stream; the rider can't stop it, and will know who did.
        { id: 'cut_feed', title: 'Have command take the stream down', icon: 'handover', check: check(PRESS, 2), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
          summary: 'Your squad waits while command gets {stream_app} on the phone, two time zones away, to end the stream. The picture goes black in front of {rider.first}, mid-sentence, and {rider.first} will know who did it.',
          pull: 'Take away the audience {rider.first} talks to.',
          cost: 'You take the stream from {rider.first} without asking.',
          preview: { favorable: 'The picture goes black, and {rider.first} picks up your line.', mixed: '{rider.first} gets a second phone streaming within minutes.', adverse: 'With the stream dead, {rider.first} turns on {manager.first}, handgun in hand.' },
          outcomes: {
            favorable: [{ text: 'The stream drops while {rider.first} is mid-sentence. When the negotiator calls, {rider.first} picks up on the first ring and asks for the stream back.',
              exchange: [{ by: 'rider', line: 'Put it back. Put it back and I’ll talk.' }], mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 10, pressure: 4 }],
            mixed: [{ text: 'The stream goes black. {rider.first} makes {clerk.first} hand over the phone from {clerk.his} apron and starts a new stream on it. The old viewers find it within minutes, and more come with them.',
              exchange: [{ by: 'rider', line: 'You can’t turn off two phones.' }], mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'way_out' }, objective: 4, pressure: 6 }],
            adverse: escalate({
              lead: '{rider.first} watches the stream end on the screen, then turns to the front window.',
              threat: '{rider.first} drags {manager.first} up by the collar and puts the handgun against {manager.his} back, facing the glass.',
              quiet: '{rider.first} sweeps the dead phone off the counter and stands over {manager.first} without answering the line.',
              extra: { mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
          } },
        // The same act as watching from the corner, so not after it.
        { id: 'team_glass', title: 'Move your squad up to the glass', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE), minutes: 3, consequenceLevel: 'moderate', onlyIf: { notMarks: ['looked'] },
          certBonus: SURVEILLANCE,
          summary: '{lead} leads your squad to the front windows, near enough to reach {manager.first} in seconds and see the handgun. Helmets at the windows show up on the stream within a minute.',
          pull: 'A few steps from {manager.first}, with a clear view of the handgun.',
          cost: 'Everyone watching sees officers move in, and so does {rider.first}.',
          preview: { favorable: 'Your squad gets to the windows unseen.', mixed: 'Your officers are in place, but a helmet shows on the stream.', adverse: '{rider.first} spots helmets and drags {manager.first} with the handgun out.' },
          outcomes: {
            favorable: [
              { text: 'Officers settle on both sides of the front windows. The handgun hangs low in {rider.first}’s right hand. {manager.first} is a few steps from the door, and the stream shows an empty street.',
                reveal: ['handgun'], mark: ['team_close'], next: { node: 'way_out' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'The lead officer marks a clear path from the cooler to the door, with no rack in the way.' },
            ],
            mixed: [{ text: 'Officers reach the windows, but a helmet shows at the edge of the picture. The chat points the helmet out first, and {rider.first} moves to stand over {manager.first}.',
              reveal: ['handgun'], mark: ['team_close', 'performing'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { node: 'way_out' }, objective: 6, pressure: 4 }],
            adverse: escalate({
              lead: '{rider.first} finds a screenshot of helmets at the windows in the comments and shows it to the camera.',
              threat: '{rider.first} pulls {manager.first} up between {rider.himself} and the window, with the handgun pressed to {manager.his} side.',
              quiet: '{rider.first} drags {manager.first} behind the counter, away from the windows.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['team_close', 'performing'], moves: { rider: 'team_seen' }, bump: { stream: 16 }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the stream is down
    { id: 'off_air', stage: 'adapt',
      threat: { label: '{rider.first} stands over {manager.first}', minutes: 12, text: '{rider.first} stops pacing and stands over {manager.first}, asking {manager.him} who took the bag, over and over.', pressure: 6, moves: { rider: 'provoked' },
        beats: [
          { id: 'stops_twice', at: 1.5, by: 'radio', line: 'Window. Subject standing over the manager again.' },
          { id: 'no_one', at: 3.1, by: 'rider', line: 'There’s no camera now. You get that?' },
        ],
        timeout: { text: 'The register phone doesn’t ring. {rider.first} asks again, and this time {manager.first} lifts {manager.his} head to answer.', next: { node: 'same_question' } } },
      prompt: 'The stream is gone. {rider.first} paces the length of the counter and stops each time {rider.he} {rider~reaches|reach} {manager.first}.',
      exchange: [{ by: 'rider', line: 'No more stream. So who sees what happens to {manager.first}?' }, { by: 'negotiator', line: 'You wanted witnesses. What do you need me to hear now?' }],
      promptIf: [
        { when: { marks: ['cut'] }, prompt: 'Command took the stream down. {rider.first} picks up the dead phone, props it back against the register and checks the screen again.',
          exchange: [{ by: 'rider', line: 'You did that. You took them away.' }, { by: 'negotiator', line: 'I did. I want to hear you without them.' }] },
        { when: { notSafe: ['clerk'] }, prompt: 'The stream is down. {rider.first} paces between {manager.first} on the floor and {clerk.first} in the stockroom doorway.' },
      ],
      choices: [
        { id: 'own_it', title: 'Tell {rider.him} it was you', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} tells {rider.first} command ended the stream. {rider.first} has asked for the viewers back. You can’t offer that.',
          pull: 'A true answer, when {rider.first} asks who did it.',
          cost: '{rider.first} hears that you took {rider.his} viewers away.',
          preview: { favorable: '{rider.first} talks to you and lets {manager.first} walk out.', mixed: '{rider.first} believes you and goes back to pacing.', adverse: '{rider.first} hangs up on you, and nothing stands between {manager.first} and the handgun.' },
          outcomes: {
            favorable: [{ text: '{rider.first} says nothing until the negotiator checks the line is open. Then {rider.he} {rider~tells|tell} the whole story again from 11:40, with no comments to answer. At the end {rider.he} {rider~tells|tell} {manager.first} to get up and go, and {manager.first} goes.',
              safe: ['manager'], mark: ['terms', 'still_armed'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
              clerkToo('{clerk.first} leaves by the front door with {manager.him}.'),
              { when: { lead: ['calm_voice'] }, text: '{rider.first} asks the negotiator, “You wrote down 11:40?”' }],
            mixed: [{ text: '{rider.first} says {rider.he} {rider~believes|believe} the negotiator, and that the police are no better than {delivery_app}. {rider.He} {rider~goes|go} back to pacing with the line open.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} drops the phone on the counter and tells the negotiator to stop calling.',
              threat: 'Then {rider.he} {rider~kneels|kneel} beside {manager.first} and {rider~presses|press} the handgun to {manager.his} shoulder.',
              quiet: 'The line stays open, silent on both ends.',
              quietNext: { node: 'way_out' },
              extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
          } },
        // Off the stream the squad can move unseen, and the rider just said why that frightens them.
        { id: 'move_up_dark', title: 'Move your squad up while nobody films', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE, 2), minutes: 4, consequenceLevel: 'moderate',
          certBonus: SURVEILLANCE,
          summary: 'With the stream down, {lead} walks officers up the dark sidewalk to the door, near enough to pull {manager.first} out. If {rider.first} spots one helmet in the glass, {manager.first} is right beside {rider.him}.',
          pull: '{manager.first} within reach, and no picture of the move.',
          cost: 'One helmet in the dark glass, and {rider.first} is standing over {manager.first}.',
          preview: { favorable: 'Your squad reaches both sides of the door without being seen.', mixed: '{rider.first} catches a glint at the window and stands over {manager.first}.', adverse: '{rider.first} spots helmets in the dark, standing over {manager.first} with the handgun.' },
          outcomes: {
            favorable: [
              { text: 'Officers come up the dark sidewalk and split to both sides of the door. Through the glass the handgun hangs at {rider.first}’s side, and {manager.first} glances at the stockroom whenever {rider.first} turns away.',
                reveal: ['handgun'], mark: ['team_close'], next: { node: 'way_out' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'From the door the lead officer can make out the whiteboard behind the register. Someone has smudged one of the pickup times.' },
            ],
            mixed: [{ text: 'Officers reach the door, but the cooler light catches the edge of a helmet. {rider.first} stands over {manager.first} and asks the negotiator who is out there.',
              reveal: ['handgun'], mark: ['team_close'], moves: { rider: 'team_seen' }, next: { node: 'way_out' }, objective: 6, pressure: 4 }],
            adverse: escalate({
              lead: '{rider.first} sees two helmets in the dark glass and stops pacing. {rider.He} {rider~says|say} there’s no camera now to see what happens next.',
              threat: '{rider.first} hauls {manager.first} off the floor and holds the handgun to {manager.his} side in front of the window.',
              quiet: '{rider.first} switches off the store lights and waits in the dark by the register.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['team_close'], moves: { rider: 'team_seen' }, pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the clerk is out (the turn)
    { id: 'clerk_talks', stage: 'adapt',
      threat: { label: 'The clerk’s phone lights up', minutes: 10, text: '{clerk.first}’s phone buzzes in an officer’s hand. It is {manager.first}’s number, calling from inside.', pressure: 4, bump: { stream: 6 },
        beats: [
          { id: 'clerk_shakes', at: 1.6, by: 'clerk', line: 'Is {manager.first} okay? Just tell me {manager.first} is okay.' },
          { id: 'rider_asks', at: 3.2, by: 'rider', line: 'Where’s the kid? Somebody took the kid.', moves: { rider: 'team_seen' }, bump: { stream: 6 } },
        ],
        timeout: { text: 'The phone rings out in the officer’s hand. {clerk.first} asks to call {manager.first} back.', next: { node: 'phone_rings' } } },
      prompt: '{clerk.first} sits behind the patrol car in a blanket, watching the stream on an officer’s phone. {clerk.He} {clerk~keeps|keep} telling the officer {clerk.he} didn’t say anything to anybody.',
      exchange: [{ by: 'negotiator', line: 'What didn’t you say?' }, { by: 'clerk', line: 'About the bag. About that night.' }],
      promptIf: [{ when: { marks: ['seen_back'] }, prompt: '{clerk.first} is out, and the stream showed the stockroom door moving. Inside, {rider.first} is asking the comments where the kid went.',
        exchange: [{ by: 'rider', line: 'They took the kid. What else are they doing back there?' }, { by: 'clerk', line: 'I didn’t tell them anything. I swear I didn’t.' }] }],
      choices: [
        { id: 'clerk_asked', title: 'Ask {clerk.first} what happened at 11:40', icon: 'search', talksTo: 'clerk', check: check(ASK, -2), minutes: 4,
          summary: '{lead} sits on the bumper beside {clerk.first} and asks about the night the bag went missing. {clerk.first} is nineteen, shaking, and watching the stream on the officer’s phone the whole time you ask.',
          pull: '{clerk.first} worked the register at 11:40 that night.',
          cost: 'You question a nineteen-year-old while {manager.first} is held inside.',
          preview: { favorable: 'You hear what {clerk.first} saw at the register.', mixed: '{clerk.first} starts to answer and asks for {manager.first} instead.', adverse: '{clerk.first} stops talking, and inside the count keeps climbing.' },
          outcomes: {
            favorable: [
              { if: CLEAR, text: '{clerk.first} answers looking at the ground. {clerk.He} {clerk~says|say} {clerk.he} took the bag off the counter before the rider got there, because {clerk.he} {clerk~was|were} hungry and the order had sat for twenty minutes. {manager.first} found the receipt in {clerk.his} apron the next day and called {delivery_app} about the rider.',
                exchange: [{ by: 'clerk', line: '{manager.He} said they’d never fire me if it was the rider.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'way_out' }, objective: 15 },
              { if: TOOK, text: '{clerk.first} says {rider.first} picked the bag up at 11:40 like any other night. The customer called later to say it never came, though {delivery_app} showed it delivered. {clerk.He} saw the pickup on the store camera, and {manager.first} kept the clip.',
                exchange: [{ by: 'clerk', line: 'I didn’t say anything. I didn’t want {rider.him} to get in trouble.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'way_out' }, objective: 12 },
            ],
            mixed: [{ text: '{clerk.first} gets as far as the register that night and stops. {clerk.He} {clerk~wants|want} to know if {manager.first} is going to be all right, and won’t say more until someone answers.',
              next: { node: 'way_out' }, objective: 6 }],
            adverse: [{ text: '{clerk.first} pulls the blanket over {clerk.his} head and won’t talk to anyone. On the officer’s phone, the count climbs over three thousand.',
              bump: { stream: 10 }, next: { node: 'way_out' }, objective: 3, pressure: 4 }],
          } },
        // The temptation (dilemma pattern 15): a story that ends the stand-off, if it is true.
        { id: 'say_clerk_backs', title: 'Tell {rider.him} {clerk.first} backs {rider.him}', icon: 'radio', talksTo: 'rider', deceives: true, check: check(TALK, 4), minutes: 2, consequenceLevel: 'high',
          summary: '{clerk.first} hasn’t said who took the bag, so this is a lie until someone checks. {lead} tells {rider.first} that {clerk.first} is outside saying {rider.first} didn’t take it. If that’s false, {rider.first} hears so on the stream.',
          pull: '{rider.first} hears the words {rider.he} came for.',
          cost: 'A claim you haven’t checked, said to thousands of people who will.',
          preview: { favorable: '{rider.first} sits down and starts talking about walking out.', mixed: '{rider.first} wants {clerk.first} to say it in person.', adverse: '{clerk.first} contradicts you on the stream, and the handgun may come up at {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} asks the negotiator to say it again, then repeats it to the camera {rider.himself} and sits on the floor, back against the cooler.',
              promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'released' }, next: { node: 'way_out' }, objective: 15, pressure: -8 }],
            mixed: [{ text: '{rider.first} wants to hear {clerk.first} say it in {clerk.his} own voice. The negotiator says {clerk.first} is with the medic, and {rider.first} says {rider.he} will wait.',
              promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: 'A comment appears under the picture from {clerk.first}’s own account, typed in the back of the patrol car. It says {clerk.first} hasn’t talked to the police about the bag, and {rider.first} reads it out.',
              threat: '{rider.first} aims the handgun at {manager.first} while telling the camera this is what the police do.',
              quiet: '{rider.first} hangs up and lets the callback ring.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'way_out', stage: 'resolve',
      threat: { label: 'The {outlet_short} van parks', minutes: 12, text: 'A {outlet_short} van parks at the corner, and its crew raises a light on the front door. {rider.first} watches the light from behind the counter.', pressure: 5, bump: { stream: 18 },
        beats: [
          { id: 'medic', at: 1.8, by: 'radio', line: 'Medic staged down the block.' },
          { id: 'how_out', at: 3.4, by: 'rider', line: 'If I walk out, do I walk out on camera? Yes or no.', bump: { stream: 5 } },
          { id: 'camera_door', at: 4.6, by: 'radio', line: 'Van camera on the front door. Lights up.', bump: { stream: 4 } },
        ],
        timeout: { text: '{rider.first} asks the yes or no question again and gets no answer from outside.', next: { node: 'van_light' } } },
      prompt: '{rider.first} is talking about coming out, but not about how. A {outlet_short} camera on the corner is trained on the front door, and {manager.first} hasn’t moved from beside the cooler.',
      exchange: [{ by: 'rider', line: 'I come out on camera or I don’t come out.' }, { by: 'negotiator', line: 'Tell me why the camera matters.' }, { by: 'rider', line: 'Because then you can’t say what happened.' }],
      promptIf: [
        { when: { marks: ['admitted'] }, prompt: '{manager.first} said it on camera, and the comments haven’t stopped since. {rider.first} looks from the count to the front door.',
          exchange: [{ by: 'rider', line: 'You heard it. Everybody heard it.' }, { by: 'negotiator', line: 'They did. Which door do you want to use?' }] },
        { when: { marks: ['exposed'] }, prompt: 'The stream heard {manager.first} say it, and {rider.first} has stopped arguing with the comments. {rider.He} {rider~asks|ask} which door, and who will be standing on the step.',
          exchange: [{ by: 'rider', line: 'If I walk out, they all watch me walk out.' }, { by: 'negotiator', line: 'Then they watch you walk out. That’s all they see.' }] },
        { when: { marks: ['news_on'] }, prompt: '{outlet} is carrying the stream now, and the count has gained a digit since the repost. {rider.first} asks how to come out but keeps checking the number.' },
        { when: { marks: ['phone_wall'] }, prompt: 'The phone faces the wall, and nobody reads the comments coming through the speaker. {rider.first} is asking the negotiator about the door.' },
        { when: { marks: ['lied_clerk'] }, prompt: '{rider.first} believes {clerk.first} is on {rider.his} side. {rider.He} {rider~keeps|keep} asking when {clerk.first} will say it to the camera.' },
        { when: { marks: ['turned_chat'] }, prompt: 'The comments are calling {rider.first} a liar now. {rider.He} {rider~stands|stand} by the register with the phone and the handgun and {rider~asks|ask} the line how a person would even walk out of here.' },
      ],
      choices: [
        // Not after command cut the stream: there is no stream to walk out on.
        { id: 'walk_live', title: 'Let {rider.him} walk out on the stream', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, 0), minutes: 6, onlyIf: { notMarks: ['lie_found', 'cut', 'stream_off'] },
          modifiers: [{ label: 'The camera is on the wall', mark: 'phone_wall', value: -4 }],
          favors: [STEADY_ON_CAMERA],
          summary: 'Agree that {rider.first} comes out filming, so everyone watching can see what happens to {rider.him} after. {manager.first} goes first. Every move your squad makes goes out live on {stream_app} and on the {outlet_short} camera.',
          pull: 'The exit {rider.first} asked for, in front of witnesses.',
          cost: 'At the door, {rider.first} has the biggest audience of the night.',
          preview: { favorable: '{manager.first} comes out first, and {rider.first} follows filming, the handgun left inside.', mixed: '{manager.first} walks out, and {rider.first} sees the camera and backs inside, armed.', adverse: 'At the door {rider.first} turns to the camera. If the handgun comes up, {manager.first} is right there.' },
          outcomes: {
            favorable: [
              { text: '{manager.first} goes out first, holding the door frame. {rider.first} follows with the phone held up, filming {rider.his} own empty right hand, the way the negotiator tells {rider.him} to. Two officers take {rider.him} on the sidewalk in front of the {outlet_short} camera, and the count climbs higher than it has been all night.',
                safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 75, pressure: -12 },
              clerkToo('{clerk.first} slips out the stockroom door a minute earlier, off camera.'),
            ],
            mixed: [
              { text: '{manager.first} gets out. On the step {rider.first} sees the van’s light come up on the corner and backs inside with the phone held high. The handgun is back in {rider.his} hand by the register.',
                safe: ['manager'], mark: ['still_armed', 'performing'], bump: { stream: 12 }, next: { node: 'last_word' }, objective: 40, pressure: 4 },
              foundOut('Then {clerk.first}’s own account posts under the picture that {clerk.first} never told the police {rider.first} was clear. {rider.first} reads the comment out to the street.', { if: TOOK }),
              clerkToo('{clerk.first} is already outside when the door opens.'),
            ],
            adverse: escalate({
              lead: 'At the door {rider.first} stops and turns the phone around, onto {rider.himself}, and starts to tell the stream what the police will do to {rider.him} next.',
              threat: '{rider.first} raises the handgun for the camera, and {manager.first} is behind {rider.him} in the doorway.',
              anyway: 'Voices pour out of the phone’s speaker. {rider.first} turns from the door with the handgun on {manager.first}.',
              quiet: '{rider.first} backs inside, filming, and shuts the door on the street.',
              quietNext: { node: 'last_word' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 20 }, pressure: 10 } }),
          } },
        { id: 'walk_dark', title: 'Phone face down, then walk', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, 1), minutes: 5,
          modifiers: [{ label: 'The camera is already on the wall', mark: 'phone_wall', value: 6 }, { label: '{rider.first} is playing to the chat', mark: 'performing', value: -5 }],
          favors: [CALM_ON_CAMERA],
          summary: '{lead} asks {rider.first} to turn the phone over on the register and walk out with no stream of {rider.his} own. It is the exit {rider.first} has refused all night.',
          pull: 'The phone stays inside, so there is nothing to perform for.',
          cost: '{rider.first} has only your word for what happens outside.',
          preview: { favorable: '{rider.first} sets the phone down and walks out to you.', mixed: '{rider.first} comes out, but only after an hour of stalling.', adverse: '{rider.first} won’t put the phone down, and stays behind the counter with {manager.first}.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} lays the phone face down on the register and sets the handgun beside it. {manager.first} walks out first. {rider.first} follows with open hands and asks the first officer to tell {friend.first}.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 75, pressure: -12 }, clerkToo('{clerk.first} slips out the back while the phone is face down.'),
            ],
            mixed: [{ when: ON_STREAM, text: '{rider.first} keeps picking the phone back up to read the comments. After an hour of it {rider.he} {rider~lets|let} {manager.first} go and {rider~follows|follow} {manager.him} out with nothing in {rider.his} hands.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 60, minutes: 40 },
              { when: STREAM_CUT, text: '{rider.first} talks on the register phone for most of an hour. Then {manager.first} walks out, and {rider.first} comes after {manager.him} with empty hands.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 60, minutes: 40 },
              { when: STREAM_ENDED, text: '{rider.first} stares at the dark phone a long while. {manager.first} is sent out first, then {rider.first}, empty-handed.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 60, minutes: 40 },
              clerkToo('In that hour {clerk.first} slips away through the back.'),
            ],
            adverse: [{ when: ON_STREAM, text: '{rider.first} says {rider.he} {rider~knows|know} what happens to people nobody films. {rider.He} {rider~settles|settle} on the floor beside {manager.first} and {rider~props|prop} the phone on {rider.his} knee to keep streaming.', moves: { rider: 'provoked' }, objective: 10 }, { when: STREAM_CUT, text: '{rider.first} refuses, the dead phone in {rider.his} lap, and won’t move from beside {manager.first}.', moves: { rider: 'provoked' }, objective: 10 }, { when: STREAM_ENDED, text: '{rider.first} won’t walk without a picture and sits down by {manager.first}, turning the phone over and over.', moves: { rider: 'provoked' }, objective: 10 },
              { when: { notSafe: ['clerk'] }, text: '{clerk.first} sits against the stockroom door frame.' }, { when: { safe: ['clerk'] }, text: '', next: { ending: 'held_counter' } }, { when: { notSafe: ['clerk'] }, text: '', next: { ending: 'held_both' } }, ],
          } },
        // The lie found out (temptation). Only on the branch where the team said the clerk backs the rider.
        { id: 'own_lie', title: 'Tell {rider.him} the truth about {clerk.first}', icon: 'radio', talksTo: 'rider', check: check(TALK, 0), minutes: 4, onlyIf: { marks: ['lied_clerk'], notMarks: ['lie_found'] },
          summary: '{lead} tells {rider.first} that nobody asked {clerk.first} about the bag before you said {clerk.first} backed {rider.him}. {rider.first} is sitting down now, and may not stay down.',
          pull: 'Take back the lie before {rider.first} reads it in the comments.',
          cost: '{rider.first} learns the words {rider.he} sat down for were made up.',
          preview: { favorable: '{rider.first} hears you out and asks how to walk out.', mixed: '{rider.first} stands up again and asks the stream what to do.', adverse: '{rider.first} hears that the police lied, and the handgun could come up at {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} asks what {clerk.first} really said. The negotiator says nobody has asked {clerk.him} yet. After that {rider.first} wants to know what {rider.he} {rider~has|have} to do to walk out.',
              breaks: ['clerk_backs'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 20 }],
            mixed: [{ text: '{rider.first} stands up and asks the stream whether {rider.he} should believe the police now. The comments answer in a hundred ways at once.',
              breaks: ['clerk_backs'], mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'last_word' }, objective: 10 }],
            adverse: escalate({
              lead: '{rider.first} tells the viewers the police lied to {rider.him} just like {delivery_app}.',
              threat: '{rider.first} levels the handgun on {manager.first} and keeps it there.',
              anyway: '{rider.first} is on {rider.his} feet, shaking, the handgun pointed at {manager.first}.',
              quiet: '{rider.first} pockets the phone, streaming the inside of {rider.his} jacket, and sits with {rider.his} back to the counter.',
              quietNext: { node: 'last_word' },
              extra: { breaks: ['clerk_backs'], mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
          } },
        // Only after the rider ended the stream and asked what happens to people who lie to everyone.
        { id: 'honest_next', title: 'Tell {rider.him} what happens next', icon: 'radio', walks: 'manager', talksTo: 'rider', check: check(TALK, -2), minutes: 5, onlyIf: { marks: ['ended_it'] }, certBonus: NEGOTIATOR,
          summary: '{lead} answers {rider.first}’s question straight. Nobody at the door can decide the charges or get {rider.first} back on {delivery_app}, and {lead} won’t pretend otherwise.',
          pull: '{rider.first} asked you a straight question.',
          cost: '{rider.first} hears that nobody can promise the job back.',
          preview: { favorable: '{rider.first} lets {manager.first} go and walks out to you.', mixed: '{manager.first} walks out, and {rider.first} stays behind the counter.', adverse: '{rider.first} sits down beside {manager.first} and stops talking.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} hears all of it without interrupting, then tells {manager.first} to go. When {manager.first} is out, {rider.first} follows with empty hands and asks an officer if {friend.first} is outside.',
                safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 75, pressure: -10 },
              clerkToo('{clerk.first} leaves by the back first.'),
            ],
            mixed: [
              { text: '{rider.first} tells {manager.first} to go, then sits down behind the counter, handgun beside {rider.him}, and asks the negotiator for a minute alone.',
                safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} goes with {manager.him}.'),
            ],
            adverse: heldEnd({ text: '{rider.first} says that is what {rider.he} thought, then lowers {rider.himself} down beside {manager.first}. After that {rider.he} {rider~answers|answer} nothing.', objective: 10 },
              '{clerk.first} stays in the stockroom doorway.'),
          } },
        { id: 'wait_night', title: 'Hold the block and wait', icon: 'wait', check: check(HOLD, -2), minutes: 45, span: 'All night',
          summary: 'Command keeps the block shut and gives {rider.first} all night if {rider.he} {rider~wants|want} it. The stream runs the whole time, and so does the {outlet_short} camera, while {manager.first} sits on the tile.',
          pull: '{rider.first} picks the hour, with no one pushing.',
          cost: '{manager.first} spends the night on the floor in front of a camera.',
          preview: { favorable: '{rider.first} lets {manager.first} go and comes out before dawn.', mixed: 'When the phone dies at first light, {manager.first} walks out ahead of {rider.first}.', adverse: 'The morning shift arrives with {manager.first} on the floor inside.' },
          outcomes: {
            favorable: [
              { text: 'Around 3:00 {rider.first} turns the phone off. {rider.He} {rider~sends|send} {manager.first} out the front, {rider~waits|wait} until {manager.he} {manager~is|are} past the patrol car, and {rider~comes|come} out after {manager.him} with {rider.his} hands empty.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 55 },
              clerkToo('{clerk.first} comes out the back ahead of them.'),
            ],
            mixed: [
              { text: 'At first light the phone battery dies, and the stream with it. {rider.first} sends {manager.first} out and walks out behind {manager.him}.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 45, minutes: 30 },
              clerkToo('{clerk.first} is sent out before either of them.'),
            ],
            adverse: heldEnd({ if: CLEAR, text: 'By the morning shift change {rider.first} has the phone charging from the register, with {manager.first} next to {rider.him} on the floor.', objective: 10 },
              '{clerk.first} hasn’t left the stockroom doorway.', [CLEAR]).concat(
              heldEnd({ if: TOOK, text: 'The morning shift arrives, and {rider.first} hasn’t moved. The phone is charging from the register and streaming to a few hundred people who stayed up.', objective: 10 },
                '{clerk.first} sits on the stockroom floor, out of the picture.', [TOOK])),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3: exposed on camera (situation 2)
    { id: 'cornered', stage: 'resolve',
      threat: { label: 'The clip spreads', minutes: 13, text: 'Someone has clipped {manager.first}’s sentence, and the clip is spreading faster than the stream. The count passes five thousand.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 15 },
        beats: [
          { id: 'thief', at: 1.2, by: 'radio', line: 'Comments calling subject a thief. Lots of them.' },
          { id: 'rider_quiet', at: 2.6, by: 'rider', line: 'They were all on my side. Every one of them.' },
        ],
        timeout: { text: '{rider.first} plays the clip on a loop, and the negotiator gets no answer.', next: { node: 'clip_going' } } },
      prompt: '{rider.first} has stopped reading the comments out. {rider.He} {rider~stands|stand} at the register looking at the phone, with the handgun hanging at {rider.his} side and {manager.first} at {rider.his} feet.',
      exchange: [{ by: 'negotiator', line: 'Are you thinking about hurting yourself?' }, { by: 'rider', line: 'I’m thinking everybody saw that.' }],
      choices: [
        { id: 'off_camera', title: 'Ask {rider.him} to shut the stream off', icon: 'radio', talksTo: 'rider', check: check(HOLD, 2), minutes: 5, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} asks {rider.first} to end the stream with {rider.his} own thumb and talk to one person instead of five thousand. The viewers who backed {rider.first} all night are calling {rider.him} a liar while {rider.he} {rider~does|do} it.',
          pull: 'Five thousand people leave the room at once.',
          cost: '{rider.first} has to quit in front of the viewers who turned.',
          preview: { favorable: '{rider.first} switches the stream off and talks to you.', mixed: '{rider.first} goes off the air and stops answering the line.', adverse: '{rider.first} keeps scrolling, the handgun in hand and {manager.first} at {rider.his} feet.' },
          outcomes: {
            favorable: [{ text: '{rider.first} ends the stream {rider.himself} and sets the phone face up on the register. Then {rider.he} {rider~asks|ask} the negotiator what happens to people who lie to everyone.',
              stabilize: ['stream'], mark: ['ended_it', 'stream_off'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -10 }],
            mixed: [{ text: 'The stream goes off. {rider.first} stands at the register and lets the line ring.',
              stabilize: ['stream'], mark: ['stream_off'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 }],
            adverse: escalate({
              lead: '{rider.first} keeps scrolling through the comments and won’t look up from the screen.',
              threat: '{rider.first} lifts the handgun toward {manager.first} and reads the next comment to {manager.him}.',
              anyway: '{rider.first} turns on {manager.first} with the handgun up, saying {manager.he} did this.',
              quiet: '{rider.first} slides down to sit against the counter with the phone held to {rider.his} chest.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
        { id: 'friend_stays', title: 'Ask {rider.him} who should take the scooter home', icon: 'radio', talksTo: 'rider', check: check(TALK, -2), minutes: 5,
          summary: 'Ask {rider.first} what to do with the scooter parked out front, and tell {rider.him} {friend.first} is waiting at the patrol line. You are talking about tomorrow while the clip replays, and {rider.first} can hear it as a trick.',
          pull: 'A choice about tomorrow that is {rider.first}’s to make.',
          cost: 'You talk about a scooter while {manager.first} sits within reach of the handgun.',
          preview: { favorable: '{rider.first} hands the scooter to {friend.first} and lets {manager.first} go.', mixed: '{rider.first} tells you where the key is and goes quiet.', adverse: '{rider.first} laughs at the question, and the handgun may turn on {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} says {friend.first} should take the scooter. {rider.He} {rider~asks|ask} the negotiator to tell {friend.first} to wait, and the negotiator says {friend.first} hasn’t left the patrol line.',
              exchange: [{ by: 'rider', line: 'Key’s under the seat. Tell {friend.first} not to leave.' }], safe: ['manager'], mark: ['friend_promise', 'still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 40 },
              { text: 'Then {rider.first} waves {manager.first} toward the door.' },
              clerkToo('{clerk.first} follows {manager.first} out the front.')],
            mixed: [{ text: '{rider.first} says the key is under the seat and stops there. {rider.He} {rider~keeps|keep} the line open and {rider~reads|read} the comments to {rider.himself}.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} laughs at the word tomorrow. Then {rider.he} {rider~reads|read} the negotiator the newest comment.',
              threat: '{rider.first} points the handgun at {manager.first} from a foot away.',
              anyway: '{rider.first} turns the handgun on {manager.first} although nobody inside has said a word.',
              quiet: '{rider.first} throws the phone across the floor, where it lands face down and keeps streaming.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3: the handgun is up
    { id: 'threat', stage: 'resolve',
      threat: { label: 'The {outlet_short} van goes live', minutes: 10, text: 'The {outlet_short} van goes live from the corner, with its light on the front window and {rider.first} in the middle of it.', pressure: 6, bump: { stream: 20 },
        timeout: { text: 'Every officer holds position while the broadcast runs.', next: { node: 'on_the_news' } } },
      prompt: 'The handgun is pointed at {manager.first} now. {manager.first} keeps {manager.his} eyes on {rider.first}’s face, not on the handgun.',
      exchange: [{ by: 'radio', line: 'Window. Handgun on the manager. Holding.' }, { by: 'manager', line: '{rider.first}. They’re all watching you.' }],
      promptIf: [
        { when: { notSafe: ['clerk'] }, prompt: '{clerk.first} is pressed against the stockroom door, with the handgun pointed at {manager.first} a few feet away.' },
        { when: { marks: ['shot_inside'] }, prompt: 'Ceiling dust covers the counter where the shot went up. {rider.first} holds the handgun level at {manager.first}.' },
      ],
      choices: [
        { id: 'talk_down', title: 'Talk {rider.him} down at the glass', icon: 'radio', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'rider' } }, talksTo: 'rider', check: check(TALK, 6), minutes: 3, stress: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          modifiers: [{ label: 'You know what happened at 11:40', mark: 'knows_truth', value: 6 }],
          summary: '{lead} steps up to the front window, in plain view and in line with the handgun, and says {rider.first}’s name through the glass. If {rider.first} fires, {lead} is standing where the shot goes.',
          pull: 'The voice {rider.first} has heard all night, face to face.',
          cost: '{lead} stands a pane of glass from the handgun.',
          preview: { favorable: '{rider.first} sets the handgun down, and {manager.first} walks out first.', mixed: '{manager.first} gets out the front while {rider.first} backs off, armed.', adverse: '{rider.first} fires through the window. Your officers can be badly hurt by gunfire or falling glass.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} lays the handgun on the counter, in view of the window, and lets {manager.first} out first. On the negotiator’s word {rider.he} {rider~follows|follow}, and two officers are waiting for {rider.him} at the door.',
                safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 75, pressure: -12 },
              clerkToo('{clerk.first} is out the back by then.'),
            ],
            mixed: [
              { text: '{manager.first} gets out the front door, and {rider.first} backs away from the window, the handgun up.',
                safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} is out before {manager.him}.'),
            ],
            adverse: [{ text: '{rider.first} spins toward the window and fires through the glass. Glass catches the negotiator’s forearm on the way down behind the patrol car, and {manager.first} is inside with {rider.first}.', officer: 'wounded', fire: { from: 'rider' }, mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        { id: 'go_in', title: 'Send the team in', icon: 'shield', team: { to: 'scene', entry: 'rider' }, check: check(ENTER, 8), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'Your squad is already at the glass', mark: 'team_close', value: 8 }],
          summary: 'Command approves entry. Your squad goes through the front door while {lead} holds {rider.first} at the window, and anyone in that room can be badly hurt or die, {manager.first} first. The entry goes to review whatever happens.',
          pull: 'Reach {manager.first} before {rider.first} decides.',
          cost: '{manager.first} could die in front of the camera, and so could {rider.first}.',
          preview: { favorable: 'You reach {manager.first} and get {manager.him} out.', mixed: '{manager.first} is out, hurt on the way.', adverse: '{rider.first} turns on {manager.first} as you come in. Either of them can be badly hurt, and {manager.first} may die.' },
          outcomes: {
            favorable: [
              { text: 'The team is through the door before {rider.first} turns. {manager.first} is out on the sidewalk, and officers have {rider.first} on the floor with the handgun out of reach.', safe: ['manager'], out: ['rider'], next: { ending: 'entry_clean' }, objective: 50 },
              clerkToo('{clerk.first} runs for the back door as the front one opens.'),
            ],
            mixed: [
              { text: '{manager.first} falls hard against the cooler as the team pulls {manager.him} clear. The medic at the corner checks {manager.his} arm, and {rider.first} is taken.', safe: ['manager'], harm: { manager: 'wounded' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 35 },
              clerkToo('Officers bring {clerk.first} out ahead of the others.'),
            ],
            adverse: [
              { if: CALM, text: '{rider.first} pulls {manager.first} down behind the register as the door gives. {manager.first} hits the floor hard, and {rider.first} lets go when the team reaches them.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
              { if: RAISED, text: '{rider.first} fires at {manager.first} as the officers come through, then turns on them.', reveal: ['raised'], harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
              { if: RAISED, text: '', fire: { from: 'rider' } },
              clerkToo('{clerk.first} gets out the back during the entry.'),
            ],
          } },
        { id: 'go_dark', title: 'Kill the lights and the stream', icon: 'wait', check: check(MOVE, -2), minutes: 8,
          summary: 'Command cuts the power to {place}, which takes the stream down with it, and every officer steps back out of sight. In the dark, no officer is close enough to reach {manager.first} if the handgun goes off.',
          pull: '{rider.first} loses the camera and the officers at the window at once.',
          cost: 'No officer can see {manager.first} once the lights are out.',
          preview: { favorable: 'In the dark {rider.first} lowers the handgun and lets {manager.first} go.', mixed: '{rider.first} puts the handgun down but won’t let {manager.first} go.', adverse: '{rider.first} can strike {manager.first} in the dark, with no officer near enough to stop {rider.him}.' },
          outcomes: {
            favorable: [
              { text: 'The store goes dark, and the stream with it. After a minute {rider.first} calls out, asking where everybody went, and tells {manager.first} to go while there is no one to see.', safe: ['manager'], mark: ['still_armed'], stabilize: ['stream'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} finds the back door by touch and gets out.'),
            ],
            mixed: heldEnd({ text: '{rider.first} lowers the handgun in the dark but keeps {manager.first} beside {rider.him}. Command keeps the block sealed.', stabilize: ['stream'], objective: 15 },
              '{clerk.first} stays pressed against the stockroom door.'),
            adverse: [
              ...heldEnd({ if: CALM, text: 'With no light, the team loses sight of the handgun, and {rider.first} stops answering the line.', reveal: ['raised'], stabilize: ['stream'], pressure: 8 },
                '{clerk.first} is somewhere by the stockroom door.', [CALM]),
              { if: RAISED, text: 'When the emergency light comes on, {manager.first} is curled by the cooler, struck with the handgun in the dark. {rider.first} sends {manager.him} out the front, holding {manager.his} face, and goes back behind the counter.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, stabilize: ['stream'], next: { ending: 'manager_hurt_inside' }, objective: 10, pressure: 10 },
              clerkToo('{clerk.first} is waved out after {manager.him}.', { if: RAISED }),
            ],
          } },
      ] },
    { id: 'fired_on', stage: 'resolve',
      threat: { label: 'A call from home', minutes: 10, text: '{rider.first}’s phone lights up with a call from home. {rider.He} {rider~looks|look} at the name on the screen and {rider~lets|let} it ring.', pressure: 8, bump: { stream: 15 },
        timeout: { text: 'Both phones ring out, home’s and the negotiator’s.', next: { node: 'home_again' } } },
      prompt: 'The front window has a hole in it now. {rider.first} crouches behind the counter next to {manager.first}, the handgun in {rider.his} hand.',
      exchange: [{ by: 'radio', line: 'Shot through the front glass. Checking officers outside.' }, { by: 'rider', line: 'I didn’t mean it. I didn’t mean that.' }],
      choices: [
        { id: 'go_in', title: 'Go in now', icon: 'shield', team: { to: 'scene', entry: 'rider' }, check: check(ENTER, 12), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          summary: '{rider.first} has fired once, with {manager.first} an arm’s length away. Your squad takes the front door now, and inside that room a person can die or be badly hurt. Command will review the entry whatever happens.',
          pull: 'Reach {manager.first} before the next shot.',
          cost: '{manager.first} or {rider.first} could die in the doorway.',
          preview: { favorable: 'You get to {manager.first} first and bring {manager.him} out.', mixed: 'You bring {manager.first} out with an injury.', adverse: 'As you come in, {rider.first} turns on {manager.first}, who can be badly hurt or killed.' },
          outcomes: {
            favorable: [
              { text: 'Officers reach the counter before {rider.first} can turn. Two of them carry {manager.first} out to the street, and the rest hold {rider.first} down, the handgun out of reach.', safe: ['manager'], out: ['rider'], next: { ending: 'entry_clean' }, objective: 45 },
              clerkToo('{clerk.first} is pulled out through the stockroom.'),
            ],
            mixed: [
              { text: '{manager.first} goes down against the cooler in the rush and comes out holding {manager.his} arm. Officers hold {rider.first}.', safe: ['manager'], harm: { manager: 'wounded' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 30 },
              clerkToo('{clerk.first} gets out first.'),
            ],
            adverse: [
              { if: CALM, text: '{rider.first} drags {manager.first} to the floor as officers come in. {manager.first} is badly hurt when they pull {manager.him} free, and {rider.first} lets go.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 15, civilian: -15 },
              { if: RAISED, text: '{rider.first} fires again, this time at {manager.first}, then swings toward the door.', reveal: ['raised'], harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
              { if: RAISED, text: '', fire: { from: 'rider' } },
              clerkToo('{clerk.first} crawls out the back while officers fill the front.'),
            ],
          } },
        { id: 'hold_talk', title: 'Hold and keep {rider.him} talking', icon: 'radio', talksTo: 'rider', check: check(TALK, 8), minutes: 4, stress: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} keeps the line open from behind the patrol car and takes {rider.first} at {rider.his} word that the shot was a mistake. Your squad holds the corners, too far back to reach {manager.first} if there is a second one.',
          pull: '{rider.first} says {rider.he} didn’t mean to fire.',
          cost: 'A second shot would reach {manager.first} before any officer could.',
          preview: { favorable: '{rider.first} lets {manager.first} go and puts the handgun down.', mixed: '{manager.first} gets out, and {rider.first} keeps the handgun.', adverse: '{rider.first} fires again, and {manager.first} is closest.' },
          outcomes: {
            favorable: [
              { text: 'The negotiator gets {rider.first} to set the handgun on the counter and tell {manager.first} to go. A few minutes later {rider.first} walks out with open hands.', safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 60 },
              clerkToo('{clerk.first} slips out the back during the call.'),
            ],
            mixed: [
              { text: '{manager.first} walks out the front at {rider.first}’s word. {rider.first} stays behind the counter with the handgun.', safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} goes with {manager.first}.'),
            ],
            adverse: [
              { if: CALM, text: '{rider.first} fires into the counter, and {manager.first} is hit by what comes off it. {rider.first} drops the handgun and screams for the medic.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 15, civilian: -15 },
              { if: RAISED, text: '{rider.first} fires at {manager.first}. The team goes in on the shot.', reveal: ['raised'], harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
              { if: RAISED, text: '', fire: { from: 'rider' } },
              clerkToo('{clerk.first} gets out the back in the noise.'),
            ],
          } },
      ] },

    // ------------------------------------------------------------------ stage 3: the manager is out
    { id: 'last_word', stage: 'resolve',
      threat: { label: '{rider.first} sits down', minutes: 13, text: '{rider.first} sits down behind the counter, out of sight of the window, and turns the phone so it films the ceiling.', pressure: 4,
        timeout: { text: '{rider.first} stays down there and stops answering.', next: { node: 'ceiling' } } },
      prompt: '{manager.first} is outside with the medic. {rider.first} is alone behind the counter and wants to know what happens at the door.',
      exchange: [{ by: 'rider', line: 'Everybody’s waiting to see what I do.' }, { by: 'negotiator', line: 'Then walk out with your hands open and leave the phone.' }],
      promptIf: [
        { when: { notSafe: ['manager'] }, prompt: '{manager.first} is on the floor beside {rider.first} behind the counter, and neither of them is talking.' },
        { when: { marks: ['still_armed'] }, prompt: '{manager.first} is out. The handgun lies on the counter, an inch from {rider.first}’s hand.' },
      ],
      choices: [
        { id: 'out_front', title: 'Talk {rider.him} out the front', icon: 'radio', talksTo: 'rider', check: check(TALK, 4), minutes: 6,
          modifiers: [{ label: 'The handgun is in reach', mark: 'still_armed', value: -8 }, { label: '{friend.first} is waiting outside', mark: 'friend_promise', value: 4 }],
          summary: '{lead} talks {rider.first} step by step to the front door, in view of the {outlet_short} camera. {friend.first} is across the street, and so is the van.',
          pull: 'Plain steps, and {friend.first} where {rider.first} can see {friend.him}.',
          cost: 'The {outlet_short} camera films {rider.first} walking out.',
          preview: { favorable: '{rider.first} walks out the front with empty hands.', mixed: '{rider.first} comes out, then goes silent at the camera.', adverse: '{rider.first} won’t walk out where the street can see, and stays behind the counter.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} steps out with open hands and looks across the street for {friend.first}. Officers take {rider.first} by the arms on the step.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 30 },
              { when: { notSafe: ['manager'] }, text: '{manager.first} goes out first. {rider.first} follows, palms out, into the hands of the officers at the door.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 60 }, clerkToo('{clerk.first} slips out the back before the front door opens.')],
            mixed: [{ when: { safe: ['manager'] }, text: '{rider.first} comes out with empty hands, sees the {outlet_short} camera and won’t say another word to anyone. Officers lead {rider.him} away from the door.', moves: { rider: 'provoked' }, out: ['rider'], next: { ending: 'out_on_camera' }, objective: 25, minutes: 15 },
              { when: { notSafe: ['manager'] }, text: '{rider.first} talks at the glass for twenty minutes before letting {manager.first} go, then comes out too.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 50, minutes: 15 }, clerkToo('Officers walk {clerk.first} out through the stockroom first.')],
            adverse: [{ when: { safe: ['manager'] }, text: '{rider.first} says {rider.he} won’t walk out in front of a TV camera and sits back down behind the counter.', next: { ending: 'rider_held' }, objective: 5 },
              ...heldEnd({ when: MANAGER_IN, text: '{rider.first} refuses the front door and won’t let {manager.first} up.', objective: 5 }, '{clerk.first} is crouched in the stockroom doorway.', [], MANAGER_IN)],
          } },
        { id: 'out_back', title: 'Bring {rider.him} out through the stockroom', icon: 'door', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'rider' } }, talksTo: 'rider', check: check(TALK, 2), minutes: 5,
          modifiers: [{ label: 'The handgun is in reach', mark: 'still_armed', value: -8 }],
          summary: 'The back way keeps {rider.first}’s face off the late broadcast, so {lead} brings {rider.him} out past the shelves to the alley. It is the unfilmed exit {rider.first} refused all night.',
          pull: 'No {outlet_short} footage of {rider.first} at the door.',
          cost: 'Only the police see {rider.first} come out.',
          preview: { favorable: '{rider.first} reaches the alley with empty hands.', mixed: '{rider.first} comes out the back, filming the whole way.', adverse: '{rider.first} turns around in the stockroom and returns to the counter.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} comes through the stockroom with open hands, leaving the phone on a shelf. Officers have {rider.him} before the end of the alley.', out: ['rider'], next: { ending: 'out_quiet' }, objective: 32 },
              { when: { notSafe: ['manager'] }, text: '{rider.first} sends {manager.first} out the front and walks out the back to the officers waiting there, empty-handed.', safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 62 }, clerkToo('{clerk.first} is first out the alley door.')],
            mixed: [{ when: { safe: ['manager'] }, text: '{rider.first} gives up in the alley with the phone held out, filming the officers who take {rider.him}.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 26 },
              { when: { notSafe: ['manager'] }, text: '{rider.first} lets {manager.first} leave by the front and comes out the back filming {rider.himself}.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 55 }, clerkToo('{clerk.first} reaches the alley a step ahead of them.')],
            adverse: [{ when: { safe: ['manager'] }, text: 'In the stockroom {rider.first} stops and says this is how it happens to people nobody sees. {rider.He} {rider~walks|walk} back to the register.', next: { ending: 'rider_held' } },
              ...heldEnd({ when: MANAGER_IN, text: '{rider.first} turns around at the shelves and sits down next to {manager.first}.' }, '{clerk.first} stays out of sight among the shelves.', [], MANAGER_IN)],
          } },
        { id: 'let_him_sit', title: 'Let {rider.him} decide', icon: 'wait', check: check(HOLD, -8), minutes: 45, span: 'All night',
          summary: 'Command keeps the block closed and leaves the timing to {rider.first}. Your squad holds the corner until {rider.first} comes out, even if that means daylight.',
          pull: 'Nothing for {rider.first} to push back against.',
          cost: 'Your squad stands on a corner all night, and {rider.first} sits alone with the handgun.',
          preview: { favorable: '{rider.first} calls out that {rider.he} {rider~is|are} coming out.', mixed: 'The front door opens near dawn.', adverse: 'Morning comes with {rider.first} behind the counter.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} turns the phone off, shouts through the door that {rider.he} {rider~is|are} done, and walks out to the team with {rider.his} palms showing.', out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 28 },
              { when: { notSafe: ['manager'] }, text: 'Around 3:30 {rider.first} lets {manager.first} go, and soon after follows {manager.him} out.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 55 }, clerkToo('{clerk.first} comes out of the stockroom sometime in the night.')],
            mixed: [{ when: { safe: ['manager'] }, text: 'At daybreak {rider.first} unlocks the front door and gives {rider.himself} up.', out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 24, minutes: 30 },
              { when: { notSafe: ['manager'] }, text: 'When the sky turns gray, {rider.first} sends {manager.first} out and follows.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 45, minutes: 30 }, clerkToo('{clerk.first} is let out through the stockroom at first light.')],
            adverse: [{ when: { safe: ['manager'] }, text: 'The day shift shows up outside, and {rider.first} hasn’t left the counter.', next: { ending: 'rider_held' } },
              ...heldEnd({ when: MANAGER_IN, text: 'Morning comes with {manager.first} on the floor beside {rider.first}.' }, '{clerk.first} hasn’t moved from the stockroom door either.', [], MANAGER_IN)],
          } },
      ] },

    // ------------------------------------------------------------------ run-out moments
    // When a threat's drain empties with no choice made, the call moves here (TreeTimeout, owner
    // 2026-10-21). Each moment is continued inaction made concrete: the scene the threat started has
    // gone on without the team, and its own threat carries the call forward or ends it held.
    // Design sheet: docs/calls/going-live-lapses.md.

    // stage 1: the address is out
    { id: 'address_out', stage: 'assess',
      threat: { label: 'Someone reaches the glass', minutes: 12, text: 'A viewer slips past the tape and presses a phone to the front glass to film inside. Patrol pulls the viewer back to the corner, and the stream shows all of it.', pressure: 5, moves: { rider: 'provoked' }, bump: { stream: 12 },
        beats: [
          { id: 'past_tape', at: 3.2, by: 'radio', line: 'One on foot past the corner line. Patrol has them.', bump: { stream: 4 } },
          { id: 'see_store', at: 6.6, by: 'rider', line: 'Somebody out there says they can see the store. Is that true?' },
        ],
        timeout: { text: '{rider.first} gives up on the police line and turns {rider.his} back to the window to talk to the phone.', next: { node: 'on_air' } } },
      prompt: 'Two cars have stopped at the corner with phones held out the windows, and patrol is waving them on. {rider.first} reads the new comments out loud as fast as they come.',
      exchange: [{ by: 'rider', line: 'They’re here. Some of them actually came.' }, { by: 'radio', line: 'Corner. More on foot now, phones up.' }],
      choices: [
        { id: 'call_back', title: 'Call {rider.him} back now', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} calls the register back and opens with why the police went quiet. The people at the corner hear your callback on their own phones.',
          pull: '{rider.first} hasn’t stopped answering yet.',
          cost: '{rider.first} wants to know why the police let it ring.',
          preview: { favorable: '{rider.first} picks up and tells you what {rider.he} {rider~wants|want}.', mixed: '{rider.first} answers, then talks to the corner instead of you.', adverse: '{rider.first} mocks the late call for the viewers and may raise the handgun at {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} picks up and says the police took their time. Then {rider.he} {rider~tells|tell} the negotiator about the red light at 11:40, the timestamp, and the sentence {rider.he} {rider~wants|want} from {manager.first}.',
              exchange: [{ by: 'rider', line: 'Took you long enough. Write this down.' }], mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'on_air' }, objective: 12 }],
            mixed: [{ text: '{rider.first} picks up but talks over the negotiator to the people at the corner, and waves them closer to the glass.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 6 }],
            adverse: escalate({
              lead: '{rider.first} lets the negotiator talk for a while, then tells the comments the police only call when a crowd shows up.',
              threat: '{rider.first} brings the handgun up at {manager.first} and holds the phone beside it, so the corner can see both.',
              quiet: '{rider.first} hangs up and turns the camera toward the street.',
              quietNext: { node: 'on_air' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
          } },
        { id: 'take_down', title: 'Shut the stream down now', icon: 'handover', check: check(PRESS, 4), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
          summary: 'Strangers are pulling up to the corner, so command asks {stream_app} to end the stream before more arrive. Your squad waits on the company while the corner fills, and {rider.first} loses the picture without a word from you.',
          pull: 'The stream stops leading strangers to {place}.',
          cost: 'Your first move toward {rider.first} is to take something away.',
          preview: { favorable: 'The stream ends, and the corner stops filling.', mixed: 'The stream dies, and {manager.first}’s phone brings it back.', adverse: '{rider.first} sees the screen go dark and stands over {manager.first}, handgun in hand.' },
          outcomes: {
            favorable: [{ text: 'The picture on the phone goes black while {rider.first} is reading, and the cars at the corner pull away. When the negotiator calls, {rider.first} answers on the first ring.',
              exchange: [{ by: 'rider', line: 'Who turned it off? Was that you?' }], mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 8, pressure: 2 }],
            mixed: [{ text: 'The picture is gone for a minute. Then {rider.first} pulls {manager.first}’s phone from {manager.his} pocket and starts the stream again on it.',
              mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'on_air' }, objective: 3, pressure: 6 }],
            adverse: escalate({
              lead: '{rider.first} watches the picture die and says the police care more about the cars outside than about {rider.him}.',
              threat: '{rider.first} pulls {manager.first} up against the counter with the handgun under {manager.his} arm, facing the street.',
              quiet: '{rider.first} throws the dead phone at the stockroom door and won’t pick up when the negotiator calls.',
              extra: { mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
          } },
      ] },

    // stage 2: the comments turned, and nobody answered them
    { id: 'chat_turned', stage: 'adapt',
      threat: { label: 'The chat starts guessing', minutes: 11, text: 'The chat starts guessing where {rider.first} got the handgun and whether the police will use theirs. {rider.first} answers the guesses to the camera, and the count jumps with each answer.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 12 },
        beats: [
          { id: 'three_k', at: 3.0, by: 'radio', line: 'Count’s over three thousand and climbing.', bump: { stream: 4 } },
          { id: 'knees', at: 6.2, by: 'manager', line: 'Let me sit up at least. Please, {rider.first}.', moves: { rider: 'contact' } },
        ],
        timeout: { text: 'The guesses run out before the police say anything. {rider.first} gets to {rider.his} feet, holding the phone and the handgun.', next: { node: 'way_out' } } },
      prompt: '{rider.first} crouches by the cooler and reads the worst comments out to {manager.first}, holding the screen up to {manager.his} face.',
      exchange: [{ by: 'rider', line: 'This one says I took it. Tell them who took it.' }, { by: 'manager', line: 'I can’t read it from down here.' }],
      choices: [
        { id: 'say_true', title: 'Say one true thing to the stream', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 3, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} asks {rider.first} for ten seconds on speaker and tells the stream that no one inside is hurt and the police are listening. The chat gets something to argue with besides {rider.first}, on a channel {rider.first} built to be heard on.',
          pull: 'The chat argues with you instead of with {rider.first}.',
          cost: 'A police voice on {rider.first}’s own channel.',
          preview: { favorable: '{rider.first} turns from {manager.first} back to the phone, and the comments slow.', mixed: 'The comments argue with you, and {rider.first} reads the worst ones out.', adverse: '{rider.first} cuts you off. The handgun may be pointed at {manager.first}.' },
          outcomes: {
            favorable: [{ text: 'The negotiator says the two things and stops. For a few seconds the comments argue about the police instead of {rider.first}, and {rider.first} stands up from the cooler to talk to the line.',
              moves: { rider: 'heard' }, bump: { stream: -6 }, next: { node: 'way_out' }, objective: 12, pressure: -4 }],
            mixed: [{ text: 'The comments fill with people arguing about the negotiator’s voice. {rider.first} reads the angriest ones out, standing between the phone and {manager.first} again.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 5 }],
            adverse: escalate({
              lead: '{rider.first} grabs the phone off the register before the negotiator finishes and tells the stream the police are reading from a script.',
              threat: '{rider.first} swings the handgun to {manager.first} and asks the chat whether that sounds scripted.',
              quiet: '{rider.first} mutes the speaker and goes on reading to {manager.first}.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
          } },
        { id: 'let_go_now', title: 'Ask {rider.him} to free {manager.first} now', icon: 'door', talksTo: 'rider', check: check(TALK, 6), minutes: 4, consequenceLevel: 'high',
          summary: 'Ask {rider.first} to let {manager.first} walk out now, on camera, while the chat calls {rider.first} a liar. {manager.first} is the person {rider.he} came here to hear say it.',
          pull: '{manager.first} out of reach of the handgun, now.',
          cost: '{rider.first} gives up the person who owes {rider.him} the sentence.',
          preview: { favorable: '{rider.first} steps aside, and {manager.first} makes it out the front.', mixed: '{rider.first} says no and keeps {manager.first} by the cooler.', adverse: '{rider.first} hears a trick, with {manager.first} right in front of the handgun.' },
          outcomes: {
            favorable: [{ text: '{rider.first} steps back from the cooler. {manager.first} pulls up on the handle and walks to the door, and two officers bring {manager.him} out onto the sidewalk.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
              clerkToo('{clerk.first} goes out the front a step behind {manager.him}.')],
            mixed: [{ text: '{rider.first} says {manager.first} stays until {manager.he} {manager~says|say} it. {manager.first} doesn’t say it. The handgun stays low, by {rider.first}’s leg.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 5 }],
            adverse: escalate({
              lead: '{rider.first} reads the request back to the chat and asks them what the police want with {manager.first}.',
              threat: '{rider.first} puts the handgun on {manager.first} and says now nobody is leaving.',
              quiet: '{rider.first} drops down beside {manager.first}, between {manager.him} and the door.',
              quietNext: { node: 'way_out' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
      ] },

    // stage 2: the same question, unanswered from outside
    { id: 'same_question', stage: 'adapt',
      threat: { label: '{manager.first} answers', minutes: 12, text: '{manager.first} answers in a few words. {rider.first} stands up fast and paces between the register and the cooler, and the negotiator on the line hears none of it.', pressure: 6, moves: { rider: 'provoked' },
        beats: [
          { id: 'both_quiet', at: 3.4, by: 'radio', line: 'They’re both quiet. Subject hasn’t moved.' },
          { id: 'slower', at: 6.8, by: 'rider', line: 'Say it again. Say it so I can hear it.' },
        ],
        timeout: { text: 'The words never reach the street. {rider.first} sits on the counter facing the stockroom and starts talking about coming out.', next: { node: 'way_out' } } },
      prompt: '{manager.first} has started to answer {rider.first}’s question, too low for anyone outside to hear. {rider.first} is crouched beside {manager.him} with the handgun on {rider.his} knee, listening.',
      promptIf: [{ when: { notSafe: ['clerk'] }, prompt: '{manager.first} whispers an answer to {rider.first} while {clerk.first} watches from the stockroom door. The line outside can’t pick up a word, and the handgun rests on {rider.first}’s knee.' }],
      exchange: [{ by: 'radio', line: 'Window. Subject crouched by the manager. Can’t hear them.' }, { by: 'negotiator', line: '{rider.first}, I’m on the line when you want it.' }],
      choices: [
        { id: 'answer_it', title: 'Answer the question yourself', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR,
          summary: '{lead} takes the question {rider.first} keeps asking {manager.first} and answers it on the line. The honest answer is that nobody outside knows who took the bag, and {rider.first} came for a different one.',
          pull: '{rider.first} argues with you instead of standing over {manager.first}.',
          cost: '{rider.first} hears that nobody outside can clear {rider.his} name tonight.',
          preview: { favorable: '{rider.first} gets up from beside {manager.first} to argue with you.', mixed: '{rider.first} listens, then goes back to {manager.first}.', adverse: '{rider.first} laughs off your answer, an arm’s length from {manager.first} with the handgun.' },
          outcomes: {
            favorable: [{ text: '{rider.first} gets up to argue and walks all the way to the register to do it. For a minute the shouting is between {rider.first} and the negotiator, with {manager.first} out of reach.',
              moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 12, pressure: -4 }],
            mixed: [{ text: '{rider.first} hears the answer out and doesn’t argue. Then {rider.he} {rider~crouches|crouch} by {manager.first} again and {rider~asks|ask} {manager.him} the question one more time.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 4 }],
            adverse: escalate({
              lead: '{rider.first} laughs at the answer and says that is what {delivery_app} told {rider.him} too.',
              threat: 'Then {rider.he} {rider~presses|press} the handgun against {manager.first}’s knee and {rider~says|say} somebody here knows.',
              quiet: '{rider.first} hangs up and stays crouched there, not asking anything now.',
              quietNext: { node: 'way_out' },
              extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'to_the_door', title: 'Bring your squad to the front door', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE, 4), minutes: 4, consequenceLevel: 'moderate',
          certBonus: SURVEILLANCE,
          summary: '{lead} puts officers on both sides of the entrance while {rider.first} has {rider.his} back to it. If {manager.first} crawls first, your officers have {manager.him}. If {rider.first} turns around, {rider.he} {rider~sees|see} helmets with {manager.first} at {rider.his} feet.',
          pull: 'A way out for {manager.first} that doesn’t wait on {rider.first}.',
          cost: 'If {rider.first} looks over a shoulder, the helmets are right there.',
          preview: { favorable: '{manager.first} sees you through the glass and gets to the door first.', mixed: 'You reach the door, and {rider.first} catches a sound on the step.', adverse: '{rider.first} turns, sees you, and pulls {manager.first} close with the handgun out.' },
          outcomes: {
            favorable: [{ text: '{manager.first} sees the helmets through the glass and moves on {manager.his} hands and knees while {rider.first} faces the counter. The door opens from outside. Officers have {manager.first} out on the sidewalk before {rider.first} turns around.',
              safe: ['manager'], reveal: ['handgun'], mark: ['team_close', 'still_armed'], next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} gets out through the stockroom while {rider.first} is at the front.')],
            mixed: [{ text: 'A boot scrapes the step as officers reach the door. {rider.first} turns, sees only dark glass and pulls {manager.first} back behind the counter.',
              reveal: ['handgun'], mark: ['team_close'], moves: { rider: 'team_seen' }, next: { node: 'way_out' }, objective: 4, pressure: 4 }],
            adverse: escalate({
              lead: '{rider.first} turns at a sound and sees two helmets at the door.',
              threat: '{rider.first} hauls {manager.first} to {manager.his} feet as a shield, the handgun at {manager.his} back.',
              quiet: '{rider.first} backs away from the door with {manager.first} and switches off the lights over the counter.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['team_close'], moves: { rider: 'team_seen' }, pressure: 10 } }),
          } },
      ] },

    // stage 2: the clerk is out, and the call from inside went unanswered
    { id: 'phone_rings', stage: 'adapt',
      threat: { label: 'A text from inside', minutes: 11, text: 'The calls stop, and a text comes up from {manager.first}’s number instead. It asks if the kid is okay. {clerk.first} reads it before the officer can turn the screen away.', pressure: 4, bump: { stream: 4 },
        beats: [{ id: 'why_not', at: 3.2, by: 'clerk', line: 'Why won’t anybody pick up? It’s {manager.first}.' }],
        timeout: { text: 'The text sits unanswered on the officer’s screen. {clerk.first} waits by the patrol car in the blanket, and inside, {rider.first} puts {manager.first}’s phone face down.', next: { node: 'way_out' } } },
      prompt: '{manager.first}’s number is calling {clerk.first}’s phone again, in an officer’s hand behind the patrol car. {clerk.first} is standing with {clerk.his} hand out for it. Inside, {rider.first} has {manager.first}’s phone to {rider.his} ear.',
      exchange: [{ by: 'clerk', line: 'That’s {manager.first}’s phone. Let me get it.' }, { by: 'radio', line: 'Subject has the manager’s phone up. Waiting on us.' }],
      choices: [
        { id: 'clerk_answers', title: 'Let {clerk.first} answer it', icon: 'radio', talksTo: 'clerk', check: check(ASK), minutes: 3,
          summary: '{lead} hands {clerk.first} the phone and stands at {clerk.his} shoulder. The speaker inside carries {clerk.first}’s voice to whoever holds the phone.',
          pull: 'Both people inside want to hear {clerk.first}’s voice.',
          cost: 'Nothing you do can stop {clerk.first} mid-sentence.',
          preview: { favorable: '{rider.first} lets {manager.first} speak, and you hear what {manager.first} tells {clerk.first}.', mixed: '{clerk.first} answers and can’t get a word out.', adverse: '{clerk.first} says the wrong thing to {rider.first}, and {manager.first} is the nearest person to the handgun.' },
          outcomes: {
            // Only this choice opens the turn here: the clerk on the line is who the manager talks to.
            favorable: [
              { if: CLEAR, text: 'It is {rider.first} on the line, asking if {clerk.first} is hurt. Then {rider.first} holds the phone down to {manager.first}, and {manager.first} tells {clerk.first} what {manager.he} found the morning after. The officer at {clerk.first}’s shoulder hears all of it.',
                exchange: [{ by: 'manager', line: 'You took the bag. I found the receipt in your apron.' }], reveal: ['rider_clear'], mark: ['knows_truth'], moves: { rider: 'contact' }, next: { node: 'way_out' }, objective: 12, pressure: -4 },
              { if: TOOK, text: '{rider.first} is on the line and wants to know if {clerk.first} is hurt. When the phone goes down to {manager.first}, {manager.first} tells {clerk.first} what the store camera caught, and to hold on to the clip. The officer beside {clerk.first} hears the whole call.',
                exchange: [{ by: 'manager', line: 'The clip shows {rider.first} taking the bag. Keep it.' }], reveal: ['rider_clear'], mark: ['knows_truth'], moves: { rider: 'contact' }, next: { node: 'way_out' }, objective: 12, pressure: -4 },
            ],
            mixed: [{ text: '{clerk.first} gets as far as hello and then just breathes into the phone. {rider.first} says {clerk.first}’s name twice and hangs up.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 4 }],
            adverse: escalate({
              lead: '{clerk.first} tells {rider.first} never to come back to the store.',
              threat: 'Then {rider.he} {rider~drops|drop} {manager.first}’s phone and {rider~stands|stand} over {manager.first} with the handgun pointed down at {manager.him}.',
              quiet: '{rider.first} ends the call and throws {manager.first}’s phone into the cooler.',
              quietNext: { node: 'way_out' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 8 }, pressure: 8 } }),
          } },
        { id: 'take_call', title: 'Answer it yourself', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 3, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: 'To keep {clerk.first} off the line, {lead} takes the phone and asks for {rider.first} by name. Now {rider.first} knows the police have {clerk.first}, and will want to know what {clerk.first} has told them.',
          pull: '{clerk.first} never has to hear the voice inside.',
          cost: '{rider.first} starts asking what {clerk.first} has said.',
          preview: { favorable: '{rider.first} lets {manager.first} go once you say {clerk.first} is safe.', mixed: '{rider.first} asks only about {clerk.first} and won’t talk about {manager.first}.', adverse: '{rider.first} decides {clerk.first} has talked and takes it out on {manager.first}, handgun in hand.' },
          outcomes: {
            favorable: [{ text: '{rider.first} wants to know where {clerk.first} is. The negotiator says behind a patrol car, in a blanket, and leaves it there. After a minute {rider.first} says {manager.first} can leave, and {manager.first} walks out to the officers on the step.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 38, pressure: -6 }],
            mixed: [{ text: '{rider.first} keeps asking what {clerk.first} has told the police and gets the same answer each time. {rider.first} won’t talk about letting {manager.first} go.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 5 }],
            adverse: escalate({
              lead: '{rider.first} says the police wouldn’t have {clerk.first}’s phone unless {clerk.first} had talked.',
              threat: '{rider.first} levels the handgun at {manager.first} and wants to know what {clerk.first} said.',
              quiet: '{rider.first} hangs up and stops answering {manager.first}’s phone at all.',
              quietNext: { node: 'way_out' },
              extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
          } },
      ] },

    // stage 3: the van parked, and nobody answered about the camera
    { id: 'van_light', stage: 'resolve',
      threat: { label: 'The reporter comes to the tape', minutes: 13, text: 'The {outlet_short} reporter walks up to the patrol line with a microphone and calls {rider.first}’s name toward the door on air. Through the glass, {rider.first} hears {rider.his} own name.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 14 },
        beats: [
          { id: 'reporter', at: 3.6, by: 'radio', line: 'Reporter at the tape, calling subject by name.' },
          { id: 'my_name', at: 7.2, by: 'rider', line: 'They know my name out there now. Everybody does.' },
        ],
        timeout: holdTheNight('The reporter gets no answer, and neither does {rider.first}. Command takes the street back from the cameras and settles in to wait out the night.') },
      prompt: '{rider.first} has the {outlet_short} broadcast open on {rider.his} phone, showing the store from outside. {rider.He} {rider~wants|want} the reporter on the line, not the police.',
      exchange: [{ by: 'rider', line: 'Get me the reporter. I’ll say it to them.' }, { by: 'negotiator', line: 'Say it to me first. I’m writing it down.' }],
      choices: [
        { id: 'van_back', title: 'Have command move the van back', icon: 'handover', check: check(PRESS, 2), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
          summary: 'Command asks the {outlet_short} crew to kill the light and back the van past the corner, and your squad waits while the crew argues. With the light gone there is no stage at the door, and {rider.first} watches the camera leave on {rider.his} phone.',
          pull: 'No light on the entrance for {rider.first} to perform in.',
          cost: '{rider.first} sees you send away the camera {rider.he} {rider~trusts|trust}.',
          preview: { favorable: 'The light goes off, and {rider.first} lets {manager.first} walk out.', mixed: 'The van backs off, and its long lens stays on the door.', adverse: '{rider.first} sees the light die and turns to {manager.first} with the handgun.' },
          outcomes: {
            favorable: [{ text: 'The light on the door goes off, and the van backs out of the picture. {rider.first} watches the van go on {rider.his} phone, sets the phone down and tells {manager.first} to leave. {manager.first} goes out the front.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 40, pressure: -8 },
              clerkToo('{clerk.first} comes out the back a minute later.')],
            mixed: [{ text: 'The van backs off to the corner, but the crew keeps a long lens on the door from there. {rider.first} finds the lens on the {outlet_short} picture and shows {manager.first}.',
              mark: ['performing'], bump: { stream: 6 }, next: { node: 'last_word' }, objective: 6 }],
            adverse: escalate({
              lead: '{rider.first} watches the light go off on {rider.his} phone and says the police just chased off the press.',
              threat: '{rider.first} lifts the handgun to {manager.first} and says somebody had better see this, then.',
              anyway: '{rider.first} is shouting at the dark door. {rider.He} {rider~swings|swing} around with the handgun and {rider~holds|hold} the handgun on {manager.first}.',
              quiet: '{rider.first} pulls {manager.first} down out of sight of the door and stops answering the line.',
              quietNext: { node: 'last_word' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
        { id: 'reporter_call', title: 'Let {rider.him} call the reporter', icon: 'radio', talksTo: 'rider', check: check(TALK, 6), minutes: 5, consequenceLevel: 'high', favors: [STEADY_ON_CAMERA],
          summary: 'With command’s okay, {lead} gets the reporter’s number from the crew and lets {rider.first} call from the register while the negotiator stays on the other phone. Whatever {rider.first} says goes out on {outlet_short} tonight, along with the handgun in {rider.his} hand.',
          pull: '{rider.first} gets to say it to a real camera.',
          cost: 'A reporter asks the questions, and you can’t steer them.',
          preview: { favorable: '{rider.first} says it to the reporter, lets {manager.first} out and walks out after {manager.him}.', mixed: '{rider.first} talks to {outlet_short} at length, and {manager.first} stays inside.', adverse: 'The reporter asks about the handgun on air, and {rider.first} could turn it on {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} gives the reporter the timestamp and the red light without stopping. Then {rider.he} {rider~sends|send} {manager.first} out and {rider~walks|walk} into the {outlet_short} light with empty hands, the handgun left by the register. Two officers meet {rider.him} at the curb.',
              safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 75, pressure: -12 },
              clerkToo('{clerk.first} goes out through the stockroom before them.')],
            mixed: [{ text: '{rider.first} stays on with the reporter for twenty minutes and tells it twice. When the reporter brings up the handgun on air, {rider.first} hangs up and sits down with the handgun behind the counter, beside {manager.first}.',
              mark: ['performing'], bump: { stream: 10 }, next: { node: 'last_word' }, objective: 8 }],
            adverse: escalate({
              lead: 'The reporter asks on air whether the handgun is loaded, and {rider.first} hears the question twice, once from the phone and once from the street.',
              threat: '{rider.first} answers by pointing the handgun at {manager.first}.',
              anyway: '{rider.first} hangs up on the reporter and swings the handgun toward {manager.first}.',
              quiet: '{rider.first} lays the phone screen down and stops talking to anyone.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 16 }, pressure: 10 } }),
          } },
      ] },

    // stage 3: the clip goes around, and nobody reached the rider
    { id: 'clip_going', stage: 'resolve',
      threat: { label: '{rider.first} stops answering', minutes: 12, text: 'The clip reaches {delivery_app}’s own account, reposted with a line about rider safety. {rider.first} reads it once, puts the phone face down and stops answering to {rider.his} name.', pressure: 6, moves: { rider: 'provoked' },
        beats: [
          { id: 'sitting', at: 3.0, by: 'radio', line: 'Subject sitting. Handgun up top, in reach.' },
          { id: 'still_here', at: 6.4, by: 'negotiator', line: '{rider.first}, I can hear the clip playing. Turn it down so I can hear you.' },
        ],
        timeout: holdTheNight('{rider.first} never answers. Command holds the block for a long night and keeps the line open.') },
      prompt: 'The clip of {manager.first}’s sentence is on accounts {rider.first} has never heard of. {rider.first} sits against the register cabinet with the handgun by {rider.his} right hand, and {manager.first} watches that hand.',
      exchange: [{ by: 'negotiator', line: 'Where are you sleeping tonight, {rider.first}?' }, { by: 'rider', line: 'I don’t know. Everybody I know saw the clip.' }],
      choices: [
        { id: 'stay_with', title: 'Stay on the line with {rider.him}', icon: 'radio', talksTo: 'rider', check: check(HOLD, 2), minutes: 5, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} stops asking for anything and keeps the line open, saying {rider.first}’s name now and then. This can go on for hours, and {manager.first} stays down by the cooler the whole time.',
          pull: 'Someone on the line who wants nothing from {rider.first}.',
          cost: 'Hours, maybe, with {manager.first} a step from the handgun.',
          preview: { favorable: '{rider.first} answers, and lets {manager.first} go.', mixed: '{rider.first} answers you and keeps {manager.first} where {manager.he} {manager~is|are}.', adverse: '{rider.first} stops answering, with the handgun by {rider.his} hand and {manager.first} a step away.' },
          outcomes: {
            favorable: [{ text: 'After a long time {rider.first} says the negotiator sounds tired. The negotiator says yes. {rider.first} tells {manager.first} to go home, and {manager.first} walks out the front.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -8 },
              clerkToo('{clerk.first} follows {manager.him} to the door.')],
            mixed: [{ text: '{rider.first} starts answering, a word at a time, and asks whether {friend.first} is outside, but not whether {manager.first} can go.',
              moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} lets the phone slide off {rider.his} knee and doesn’t pick it up again.',
              threat: '{rider.first} stands up and points the handgun at {manager.first}, saying {manager.he} started all of it.',
              anyway: '{rider.first} lurches to {rider.his} feet, and the handgun ends up on {manager.first}.',
              quiet: '{rider.first} stays down on the floor and leaves the handgun where it lies.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'out_now', title: 'Get {manager.first} out while {rider.he} {rider~watches|watch}', icon: 'door', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'manager' } }, check: check(MOVE, 4), minutes: 4, consequenceLevel: 'high',
          certBonus: SURVEILLANCE,
          summary: '{lead} catches {manager.first}’s eye through the glass and signals {manager.him} to the door while {rider.first} watches the clip. Your squad waits at the door to pull {manager.first} through. If {rider.first} turns {rider.his} head, {manager.first} is in the open with the handgun by {rider.first}’s hand.',
          pull: '{manager.first} out of the room while {rider.first} is watching the clip.',
          cost: 'If {rider.first} glances over, {manager.first} is caught halfway.',
          preview: { favorable: '{manager.first} reaches the door, and your squad pulls {manager.him} out.', mixed: '{manager.first} gets out, and {rider.first} barricades the door behind {manager.him}.', adverse: '{rider.first} sees {manager.first} halfway across and reaches for the handgun.' },
          outcomes: {
            favorable: [{ text: '{manager.first} gets up without a sound and crosses to the door, and the team pulls {manager.him} through. {rider.first} hears the latch and stays where {rider.he} {rider~is|are}.',
              safe: ['manager'], mark: ['still_armed', 'team_close'], next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} slips past the cooler and out the back while the door is open.')],
            mixed: [{ text: '{manager.first} gets out. {rider.first} hears the door and gets there a second later, locks it, and drags a rack of chips across it. Then {rider.he} {rider~goes|go} back to the counter, the handgun in {rider.his} hand.',
              safe: ['manager'], moves: { rider: 'team_seen' }, next: { ending: 'rider_held' }, objective: 30 },
              clerkToo('{clerk.first} gets through the stockroom before the door locks.')],
            adverse: escalate({
              lead: '{rider.first} looks up from the clip with {manager.first} halfway to the door.',
              threat: '{rider.first} grabs the handgun off the counter and holds the barrel on {manager.first}’s back.',
              anyway: '{rider.first} has the handgun on {manager.first} before {manager.he} {manager~reaches|reach} the door.',
              quiet: '{manager.first} stops and sits back down by the cooler, and {rider.first} watches {manager.him} do it.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'team_seen' }, pressure: 10 } }),
          } },
      ] },

    // stage 3: the handgun is up, and the van went live while nobody moved
    { id: 'on_the_news', stage: 'resolve',
      threat: { label: 'The anchor reads {rider.his} name', minutes: 11, text: 'On the broadcast the anchor reads out {rider.first}’s full name and the name of {place}. {rider.first} hears {rider.his} own name come out of the phone on the register.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 12 },
        beats: [{ id: 'no_change', at: 4.0, by: 'radio', line: 'Handgun on the manager. No change.' }],
        timeout: holdTheNight('The broadcast runs on with every officer where they stood. Command seals the block and waits for the handgun to come down.') },
      prompt: 'The {outlet_short} broadcast is showing the handgun on {manager.first}. {rider.first} keeps looking from {manager.first} to the phone, where {rider.he} can watch {rider.himself} hold the handgun.',
      promptIf: [{ when: { marks: ['shot_inside'] }, prompt: 'The {outlet_short} broadcast zooms in on the hole in the ceiling tiles. The handgun is on {manager.first}, and {rider.first} keeps checking the phone to see {rider.himself}.' }],
      exchange: [{ by: 'rider', line: 'Look. I’m on {outlet_short} now.' }, { by: 'manager', line: 'Then put it down where they can see.' }],
      choices: [
        { id: 'talk_manager', title: 'Talk to {manager.first}, not {rider.first}', icon: 'radio', talksTo: 'manager', check: check(HOLD, 4), minutes: 3, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} talks only to {manager.first} on the speaker, telling {manager.him} to breathe and keep {manager.his} eyes on {rider.first}’s face. {rider.first} holds the handgun and listens to the police talk past {rider.him}.',
          pull: '{rider.first} watches {manager.first}’s face, so keep that face still.',
          cost: '{outlet_short} airs it with {rider.first} left out.',
          preview: { favorable: 'The handgun comes down, and {rider.first} lets {manager.first} go.', mixed: '{rider.first} lowers the handgun but keeps {manager.first} on the floor.', adverse: '{rider.first} shouts over you and puts a shot through the front glass.' },
          outcomes: {
            favorable: [{ text: '{manager.first} breathes when the negotiator says to and looks at {rider.first} the whole time. After a minute {rider.first} lowers the handgun to the counter and tells {manager.first} to go. {manager.first} crawls to the door and out.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -10 },
              clerkToo('{clerk.first} gets out the back behind {manager.him}.')],
            mixed: [{ text: 'The handgun comes down to the counter. {rider.first} sits on the floor next to {manager.first} and says {manager.first} can go when the broadcast stops.',
              moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 10 }],
            adverse: [{ text: '{rider.first} shouts over the speaker that {manager.first} can talk for {manager.himself}. Then {rider.he} {rider~fires|fire} a shot through the front window toward the {outlet_short} light. The glass lands on an empty sidewalk.',
              mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'fired_on' }, pressure: 12, civilian: -6 }],
          } },
        { id: 'freeze', title: 'Freeze every officer and wait', icon: 'wait', check: check(HOLD, -2), minutes: 8, consequenceLevel: 'moderate',
          summary: 'Command tells {rider.first} on the line that every officer outside will stand still until {rider.he} {rider~speaks|speak}, and holds them there. If the handgun goes off, the nearest officer to {manager.first} is outside the front glass.',
          pull: 'Nothing outside for {rider.first} to react to.',
          cost: '{manager.first} has no officer within reach for as long as it lasts.',
          preview: { favorable: '{rider.first} turns off the broadcast and sends {manager.first} out.', mixed: 'The handgun stays up, and nobody inside answers the line.', adverse: '{rider.first} fires through the front window with no officer near {manager.first}.' },
          outcomes: {
            favorable: [{ text: 'The street holds still. Then {rider.first} turns the {outlet_short} picture off on {rider.his} phone, sets the handgun down and tells {manager.first} to get out. {manager.first} does.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 38 },
              clerkToo('{clerk.first} follows {manager.him} out the back way.')],
            mixed: heldEnd({ text: 'The handgun stays up for most of two hours, and no one inside answers the line.', objective: 8 },
              '{clerk.first} hasn’t made a sound from the stockroom.'),
            adverse: [{ text: '{rider.first} turns at a noise from the street and fires through the front window. Glass comes down on the sidewalk, and the {outlet_short} crew gets down behind the van, unhurt.',
              mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'fired_on' }, pressure: 12, civilian: -6 }],
          } },
      ] },

    // stage 3: the shot, the call from home, and nobody got through
    { id: 'home_again', stage: 'resolve',
      threat: { label: 'Home stops ringing', minutes: 12, text: 'The calls from home stop. {rider.first} turns the dark screen over twice, then looks at the hole in the front window.', pressure: 5, moves: { rider: 'provoked' },
        beats: [{ id: 'same_number', at: 3.4, by: 'radio', line: 'Same number calling again. Subject isn’t picking up.' }],
        timeout: holdTheNight('The phone stays in {rider.first}’s hand, unanswered. Command holds the street, and the team settles in behind the cars for the night.') },
      prompt: 'The call from home has started again. {rider.first} holds the phone out with the screen to the window and the handgun low in {rider.his} other hand. {manager.first} hasn’t moved since the shot.',
      exchange: [{ by: 'rider', line: 'That’s home. What am I supposed to tell them?' }, { by: 'negotiator', line: 'Then let them hear you’re all right.' }],
      choices: [
        { id: 'pick_up', title: 'Ask {rider.him} to answer the call', icon: 'radio', talksTo: 'rider', check: check(TALK, 6), minutes: 4, stress: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} asks {rider.first} to pick up and tell home {rider.he} {rider~is|are} all right. Whoever it is might already know about the shot, and the handgun is an arm’s length from {manager.first}.',
          pull: 'Someone from home on the line, and not the police.',
          cost: '{rider.first} talks to home, a reach away from {manager.first} and the handgun.',
          preview: { favorable: '{rider.first} answers, sends {manager.first} out first, then follows.', mixed: '{rider.first} answers, then hangs up and keeps {manager.first} there.', adverse: '{rider.first} lets it ring out and stays down beside {manager.first} with the handgun.' },
          outcomes: {
            favorable: [{ text: '{rider.first} answers on the last ring and listens more than {rider.he} {rider~talks|talk}. Halfway through {rider.he} {rider~lays|lay} the handgun down by the register and {rider~points|point} {manager.first} at the door. Once {manager.first} is past the patrol car, {rider.first} leaves the phone behind and follows, palms out.',
              exchange: [{ by: 'rider', line: 'It went through the window. Nobody’s hurt. I’m coming out.' }], safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 70, pressure: -12 },
              clerkToo('{clerk.first} goes out the back while {rider.first} is on the phone.')],
            mixed: [{ text: '{rider.first} answers and says it was an accident, twice, then hangs up on the caller mid-sentence. {manager.first} stays on the floor where {manager.he} {manager~is|are}.',
              moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 8 }],
            adverse: heldEnd({ text: '{rider.first} lets the phone ring out and slides down to the floor next to {manager.first}, the handgun across {rider.his} knees.', moves: { rider: 'provoked' }, objective: 5 },
              '{clerk.first} hasn’t come out of the stockroom.'),
          } },
        { id: 'pull_back', title: 'Pull every helmet out of sight', icon: 'perimeter', check: check(MOVE, -2), minutes: 5, consequenceLevel: 'moderate',
          summary: 'Pull your squad back behind the cars so the broken window shows {rider.first} nothing but street. {rider.first} can take the call or not, alone, and {manager.first} has no officer near the door.',
          pull: 'Nothing at the window for {rider.first} to aim at.',
          cost: '{manager.first} is on {manager.his} own if the handgun comes up.',
          preview: { favorable: '{rider.first} sends {manager.first} out and stays inside with the handgun.', mixed: '{rider.first} keeps {manager.first} down, away from the window.', adverse: '{rider.first} takes the empty window as a trick and settles in beside {manager.first}, armed.' },
          outcomes: {
            favorable: [{ text: 'With the window empty, {rider.first} answers the call and waves {manager.first} to the door without looking up. {manager.first} goes. {rider.first} keeps to the corner by the cooler with the handgun and the phone.',
              safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 40, pressure: -8 },
              clerkToo('{clerk.first} goes out after {manager.him}.')],
            mixed: [{ text: '{rider.first} lets the call ring out and keeps {manager.first} on the floor, but stops watching the window.',
              next: { node: 'last_word' }, objective: 8 }],
            adverse: heldEnd({ text: '{rider.first} calls the empty window a trick and won’t come out from behind the counter, or let {manager.first} up.', moves: { rider: 'provoked' }, objective: 5 },
              '{clerk.first} keeps low behind the stockroom shelves.'),
          } },
      ] },

    // stage 3: the rider sat down out of sight, and nobody got an answer
    { id: 'ceiling', stage: 'resolve',
      threat: { label: 'The line goes quiet', minutes: 13, text: 'The line stops carrying anything at all, even breathing. Through the glass the glow on the ceiling hasn’t moved.', pressure: 5,
        beats: [
          { id: 'tap', at: 4.2, by: 'negotiator', line: 'I heard that. Do it again if it was you.' },
          { id: 'no_movement', at: 8.0, by: 'radio', line: 'No movement behind the counter.' },
        ],
        timeout: holdTheNight('The line stays quiet until the shift changes, then carries one cough. Command keeps the street shut and the line open until morning.') },
      prompt: '{rider.first} hasn’t come up from behind the counter. Every few minutes {rider.he} {rider~says|say} something too low for the line to carry, and the phone beside {rider.him} lights the ceiling.',
      promptIf: [{ when: { notSafe: ['manager'] }, prompt: '{rider.first} and {manager.first} are both down behind the counter where no window reaches. The phone between them lights the ceiling. Neither of them answers the line.' }],
      exchange: [{ by: 'radio', line: 'Counter. No visual on the subject. Holding.' }, { by: 'negotiator', line: '{rider.first}. Just tap the phone if you can hear me.' }],
      choices: [
        { id: 'say_name', title: 'Keep saying {rider.his} name', icon: 'radio', talksTo: 'rider', check: check(HOLD), minutes: 6, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} says {rider.first}’s name into the line once a minute and nothing else, for as long as it takes. All that time, no one can see what {rider.first} is doing behind the counter.',
          pull: 'One thing {rider.first} only has to answer.',
          cost: 'Behind the counter, {rider.first} is out of everyone’s sight.',
          preview: { favorable: '{rider.first} answers and walks out to you, hands open.', mixed: '{rider.first} answers but stays behind the counter.', adverse: '{rider.first} never answers, with the handgun right beside {rider.him}.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: 'After a while {rider.first} says yeah. Later {rider.he} {rider~stands|stand} up, {rider~sets|set} the phone down and {rider~comes|come} out to the officers, hands open.', out: ['rider'], next: { ending: 'out_quiet' }, objective: 30 },
              { when: MANAGER_IN, text: '{rider.first} answers the name. Then {rider.he} {rider~sends|send} {manager.first} out first, {rider~leaves|leave} the phone on the counter, screen down, and {rider~follows|follow} {manager.him} out.', safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 60 },
              clerkToo('{clerk.first} is sent to the back door before them.')],
            mixed: [{ when: { safe: ['manager'] }, text: '{rider.first} answers once, to say {rider.he} {rider~is|are} listening. After that {rider.he} {rider~stays|stay} where {rider.he} {rider~is|are} until the shift changes.', next: { ending: 'rider_held' }, objective: 5 },
              ...heldEnd({ when: MANAGER_IN, text: '{rider.first} answers that much, and keeps {manager.first} down next to {rider.him}.', objective: 5 }, '{clerk.first} is somewhere in the stockroom.', [], MANAGER_IN)],
            adverse: [{ when: { safe: ['manager'] }, text: '{rider.first} doesn’t answer the name, or anything after it. The phone keeps filming the ceiling.', next: { ending: 'rider_held' } },
              ...heldEnd({ when: MANAGER_IN, text: 'Neither of them says a word back.' }, '{clerk.first} makes no sound from the stockroom.', [], MANAGER_IN)],
          } },
        { id: 'back_step', title: 'Bring your squad to the back door', icon: 'door', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'rider' } }, talksTo: 'rider', check: check(MOVE, 6), minutes: 5,
          certBonus: SURVEILLANCE,
          summary: '{lead} brings your squad around behind the store, a few steps from where {rider.first} sits, near enough to hear {rider.him} breathe. If {rider.first} decides to come out, your officers are right there. If {rider.he} {rider~hears|hear} them first, the handgun is within reach.',
          pull: 'Hands at the back door the moment {rider.first} wants out.',
          cost: '{rider.first} could hear boots outside, with the handgun beside {rider.him}.',
          preview: { favorable: '{rider.first} crawls to the back door and out to you.', mixed: '{rider.first} hears you and goes out the front, toward the camera.', adverse: '{rider.first} hears boots and pulls back behind the counter, handgun in hand.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} picks up a sound at the back door and says don’t come in. The negotiator says nobody will. A minute later the back door opens from inside. The phone lies screen down on the register behind {rider.first}, who {rider~crawls|crawl} out on {rider.his} knees with empty hands.', out: ['rider'], next: { ending: 'out_quiet' }, objective: 30 },
              { when: MANAGER_IN, text: '{rider.first} pushes {manager.first} toward the back first. The team takes {manager.first} out, and {rider.first} crawls after {manager.him} without the phone.', safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 60 },
              clerkToo('{clerk.first} is out of the stockroom first.')],
            mixed: [{ when: { safe: ['manager'] }, text: '{rider.first} hears the team at the back and walks out the front instead, toward the camera on the corner. The phone stays on the register, filming the door. Officers take {rider.him} on the step.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 26 },
              { when: MANAGER_IN, text: '{rider.first} sends {manager.first} ahead of {rider.him}, props the phone up facing the entrance, and follows {manager.first} out toward the corner. Officers have {rider.him} at the curb.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 55 },
              clerkToo('{clerk.first} is out the back first.')],
            adverse: [{ when: { safe: ['manager'] }, text: '{rider.first} hears a boot on the back step and scrambles away from the door, handgun in hand. The negotiator gets nothing out of {rider.him} after that.', next: { ending: 'rider_held' } },
              ...heldEnd({ when: MANAGER_IN, text: '{rider.first} catches the sound of boots and pulls {manager.first} down behind the counter.' }, '{clerk.first} stays hidden in the stockroom.', [], MANAGER_IN)],
          } },
      ] },
  ],
  endings: {
    out_on_camera: { title: 'Out on camera', disposition: 'resolved',
      summary: '{rider.first} walked out in front of everyone, after {manager.first}, and officers have {rider.him} now. {manager.first} and {clerk.first} are safe, sitting on the curb by the medic.',
      epilogue: '{friend.first} asked an officer where {rider.first} was being taken.',
      epilogueIf: [
        { when: { marks: ['admitted'] }, epilogue: '{rider.first}’s account was back on {delivery_app} by Friday. {rider.He} didn’t log in.' },
        { when: { marks: ['exposed', 'friend_promise'] }, epilogue: '{friend.first} rode {rider.first}’s scooter home and left the key with the neighbor, as {friend.he} said {friend.he} would.' },
      ] },
    out_quiet: { title: 'Out with the team', disposition: 'resolved',
      summary: '{rider.first} came out to the team with the phone left inside, and officers have {rider.him}. {manager.first} and {clerk.first} are safe. Before the patrol car pulled away, {rider.first} asked an officer whether anyone had filmed it.',
      epilogue: '{friend.first} waited at the patrol line until the patrol car carrying {rider.first} turned the corner.',
      epilogueIf: [{ when: { marks: ['admitted'] }, epilogue: '{manager.first} called {delivery_app} on Monday and asked how to take a complaint back.' }] },
    out_by_dawn: { title: 'Out by morning', disposition: 'resolved',
      summary: '{manager.first} and {clerk.first} are outside with the medic. {rider.first} came out after the long night and is in the team’s hands. {place} won’t open today.',
      epilogue: '{manager.first} asked twice in the night whether anyone had brought {rider.first} something to eat.' },
    entry_clean: { title: 'Out through an entry', disposition: 'resolved',
      summary: '{manager.first} and {clerk.first} are on the sidewalk, unhurt, and officers have {rider.first}, the handgun in an evidence bag. {manager.first} asks the medic whether {clerk.first} needs to be checked too.',
      epilogue: '{clerk.first} never went back to the night shift. {manager.first} didn’t ask {clerk.him} to.' },
    entry_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{manager.first} is getting care at the corner, hurt inside {place}, one arm held tight against {manager.his} side. {clerk.first} is safe. Officers are holding {rider.first}, who keeps asking whether {manager.first} is all right.',
      epilogue: '{manager.first} hasn’t said {rider.first}’s name since, not to the officers and not to the nurse who asked.' },
    manager_killed: { title: '{manager.He} didn’t come out', disposition: 'relief_partial',
      summary: '{manager.first} died on the floor of {place}, by the cooler where {manager.he} sat all night. Officers hold {rider.first}, who isn’t hurt and hasn’t said a word since. {clerk.first} is in the back of a patrol car with {clerk.his} hands over {clerk.his} face.',
      epilogue: 'The whiteboard by the register still had the night’s pickup times on it, in {manager.first}’s handwriting.' },
    manager_killed_rider_hurt: { title: 'Two carried out', disposition: 'relief_partial',
      summary: '{rider.first} is hurt, and the crew is working on {rider.him}. {manager.first} died before the team reached {manager.him}, behind the register where {manager.he} wrote the pickup times. {clerk.first} sits in a patrol car and asks to call home.',
      epilogue: '{clerk.first} gave an officer the keys to {place} and asked who was going to lock up.' },
    manager_hurt_inside: { title: 'Struck in the dark', disposition: 'relief_partial', remainingTasks: ['Talk {rider.first} out from the register'],
      summary: 'Medics have {manager.first}, hurt in the dark. {clerk.first} is safe. {rider.first} has gone back behind the register with the handgun, and the street stays shut.',
      epilogue: '{manager.first} told the medic it was {manager.his} fault, twice, on the way to the ambulance.' },
    rider_held: { title: 'Behind the counter', disposition: 'relief_partial', remainingTasks: ['Talk {rider.first} out of {place}'],
      summary: '{manager.first} is out of harm’s way. {rider.first} is holding out inside, armed, and command keeps the street shut with the line open.',
      epilogue: '{friend.first} stayed until morning, sitting on the curb across the street.' },
    held_counter: { title: 'Still on the floor', disposition: 'relief_partial', remainingTasks: ['Get {manager.first} out of {place}', 'Bring {rider.first} out alive'],
      summary: 'Command holds the street, with the team at the perimeter. {manager.first} is down beside the cooler, a reach from {rider.first} and the handgun. The team keeps the line to the register open.',
      epilogue: 'Near dawn {manager.first} asked the negotiator, over the register phone, whether {clerk.first} had gotten home.' },
    held_both: { title: 'Both still inside', disposition: 'relief_partial',
      remainingTasks: ['Bring {clerk.first} out', 'Get {manager.first} out from behind the counter', 'Talk {rider.first} into putting the handgun down'],
      summary: 'Patrol has the block sealed. {clerk.first} and {manager.first} are both inside with {rider.first} and the handgun, and the line to the register is open.',
      epilogue: '{clerk.first} sat in the stockroom doorway all night, where {manager.first} could see {clerk.him}.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get everyone out safely'],
      summary: 'The call is open, and the street stays shut. The team has no step left that it can take from here.',
      epilogue: '{manager.first} was still on the floor when the next shift called the store phone.' },
  },
  rewards: { funding: 2600, trust: 6, xp: 45 },
};
