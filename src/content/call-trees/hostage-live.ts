import type { CallTree, TreeChoice, TreeIf, TreeNext, TreeOutcome, TreeState } from './types';

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
      profile: '{manager.first} runs the night shift at {place} and filed the complaint that got {rider.first} cut off. {manager.He} {manager~writes|write} the pickup times on a whiteboard by the register in green marker, because the red one ran dry in the spring.' },
    { id: 'clerk', label: 'clerk', pronouns: 'he', kind: 'civilian',
      profile: '{clerk.first} is nineteen and stocks the coolers on the night shift. {manager.first} got {clerk.him} the job. {clerk.He} {clerk~was|were} at the register the night the order went missing.' },
    { id: 'friend', label: 'rider friend', pronouns: 'he', kind: 'bystander', place: 'outside',
      profile: '{friend.first} rides the same zone as {rider.first} and came straight from a drop when the stream started. {friend.He} {friend~waits|wait} at the patrol line on a scooter with the engine still running, typing in the comments with one thumb.' },
  ],
  // A pickup counter: a shop floor, a sales floor or a bar.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 2, timeOfDay: 'night' },
  summary: '{rider.first} wants one sentence said on camera. The night manager is on the floor behind the counter, and {rider.first} is holding a handgun and a phone.',
  coldOpen: 'On Tuesday {delivery_app} sent {rider.first} one line. Account deactivated after a customer complaint. The complaint came from {place}, about a bag of food that left the counter at 11:40 and never reached the door it was paid for. {rider.first} rode past {place} every night after that, then stopped riding at all. Tonight {rider.he} walked in at the end of the shift, set {rider.his} phone against the register with the camera on, and asked {manager.first} to say it. {manager.first} wouldn’t. Then {rider.first} took the handgun out of {rider.his} jacket. {clerk.first} was by the stockroom door with a case of water in {clerk.his} arms and hasn’t put it down.',
  pressureLabel: '{manager.first} on camera',
  pressure: { start: 18, perMinute: 0.15, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{clerk.first} called 911 from the stockroom with the phone held against {clerk.his} chest. A rider the store got cut off is back with a handgun and won’t let {manager.first} or {clerk.first} leave.',
    known: [
      '{clerk.first} told the dispatcher, “{rider.He} {rider~wants|want} {manager.first} to say it on the stream.”',
      'Patrol counts more than four hundred people watching {rider.first}’s stream on {stream_app}.',
      '{clerk.first} says {manager.first} is sitting on the floor behind the register, out of the camera.',
      'The store’s complaint says the bag left the counter at 11:40 and never arrived.',
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
    rider_clear: { label: 'Who took the bag', claim: 'Who took the bag that left the counter at 11:40.',
      confirmed: '{clerk.first} took the bag, and {manager.first} knew.', disproved: '{rider.first} came back for the bag after the drop failed.' },
    raised: { label: 'The view of the counter', claim: 'What the stream shows when {rider.first} is refused on camera.',
      confirmed: 'The stream showed {rider.first} point the handgun at {manager.first}.', disproved: 'On the stream, {rider.first} walks the length of the counter with the handgun at {rider.his} side.',
      threat: '{rider.first} pointed the handgun at {manager.first}' },
  },
  situations: [
    { note: '{rider.He} didn’t take the bag. {clerk.first} did, and {manager.first}, who got {clerk.first} the job, filed the complaint against {rider.first} to keep {clerk.him} in it. A refusal leaves {rider.first} pacing.', truth: { rider_clear: true, raised: false }, descriptors: ['suicide_self_harm', 'injury', 'police_gunfire'] },
    { note: '{rider.He} took the bag after a drop failed and told the stream otherwise. Four hundred people believe {rider.him}. A refusal on camera turns the handgun on {manager.first}.', truth: { rider_clear: false, raised: true }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
  ],
  turns: { clerk_out: ['clerk_talks'] },
  difficulty: { base: 36, perTier: 4 },
  root: 'going_live',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'going_live', stage: 'assess',
      // The address threat: a named commenter posts where the store is. The beats are the comments
      // closing in on it, read out by the rider, so the countdown is the guess getting warmer.
      threat: { label: 'Address posted by {handle}', minutes: 11, text: 'A comment from {handle} puts the street address of {place} under the picture. {rider.first} reads it out loud. The count jumps as people share it, and patrol starts turning cars away at the corner.', pressure: 4, bump: { stream: 10 },
        beats: [
          { id: 'where_is_this', at: 1.2, by: 'rider', line: 'Somebody called {handle} wants to know where this is. Should I tell them?', bump: { stream: 4 } },
          { id: 'manager_low', at: 3.4, by: 'manager', line: 'Nobody watching that pays your rent, {rider.first}.', moves: { rider: 'provoked' }, bump: { stream: 5 } },
          { id: 'cross_streets', at: 6.8, by: 'radio', line: 'Comments are guessing the cross streets. One guess is right.', bump: { stream: 6 } },
        ] },
      prompt: 'The callback rings beside the register, and {rider.first} lets it ring on the stream. {manager.first} is on the floor by the drinks cooler, eyes on the stockroom door and not the handgun. {clerk.first} stands in that doorway, still holding a case of water.',
      exchange: [{ by: 'rider', line: 'Four hundred people know I didn’t take the bag.' }, { by: 'radio', line: 'Phone still ringing. Handgun at the counter.' }],
      choices: [
        { id: 'on_stream', title: 'Talk to {rider.him} on the stream', icon: 'radio', talksTo: 'rider', check: check(TALK), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} answers on speaker, knowing every word goes out to the phone on the register and everyone watching it. It is the only line {rider.first} will pick up. The count climbs while you talk, and so does the number of people {rider.he} {rider~has|have} to look strong for.',
          pull: 'The one line {rider.first} answers, right now.',
          cost: 'Every word goes out live, and the count climbs while you talk.',
          preview: { favorable: '{rider.first} tells you what {rider.he} {rider~wants|want}, out loud, for the stream.', mixed: '{rider.first} talks to the comments instead of to you.', adverse: '{rider.first} turns the phone on {manager.first}, and the handgun could follow it.' },
          outcomes: {
            favorable: [{ text: '{rider.first} answers every question the negotiator asks, but faces the phone to do it. The bag left at 11:40. {rider.He} {rider~was|were} two blocks away, at a red light, and {delivery_app} has the timestamp. {rider.He} {rider~wants|want} {manager.first} to say on camera that {rider.he} didn’t take it. Then {rider.he} {rider~walks|walk} out. That’s all.',
              exchange: [{ by: 'rider', line: 'One sentence. Then I walk.' }], mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'on_air' }, objective: 15 }],
            mixed: [{ text: '{rider.first} reads the negotiator’s questions back to the comments and answers the comments instead. A rider in the chat types that the police are stalling. {rider.first} reads that one out too, slower.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 14 }, next: { node: 'on_air' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} picks up the phone and turns the camera on {manager.first}, close, so everyone can see {manager.his} face while the negotiator talks.',
              threat: 'The handgun follows the camera down to {manager.first}, and the stream shows both.',
              quiet: '{rider.first} hangs up on the negotiator and keeps talking to the stream, with {rider.his} back to the window.',
              quietNext: { node: 'on_air' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 16 }, pressure: 8 } }),
          } },
        { id: 'clerk_out', title: 'Get {clerk.first} out the back', icon: 'door', walks: 'clerk', team: { to: 'escort' }, check: check(MOVE, -4), minutes: 4, consequenceLevel: 'moderate',
          summary: '{lead} takes two of your squad in through the stockroom to bring {clerk.first} out while the camera faces the counter. It is one person out, fast. If the stream catches the stockroom door swing, {rider.first} learns from strangers that you move behind {rider.his} back.',
          pull: 'One person out now, while the camera points the other way.',
          cost: 'If the stream sees it, {rider.first} sees you working behind {rider.him}.',
          preview: { favorable: '{clerk.first} gets out the back without the stream seeing.', mixed: '{clerk.first} gets out, and the comments see the door move.', adverse: '{clerk.first} freezes in the doorway in front of the camera, and {rider.first} could fire.' },
          outcomes: {
            favorable: [{ text: '{clerk.first} sets the case of water down on the stockroom floor, very carefully, and walks out the back between two officers. Behind the patrol car {clerk.he} {clerk~asks|ask} for {clerk.his} phone back before anyone has asked {clerk.him} anything.',
              exchange: [{ by: 'clerk', line: 'I didn’t say anything to anybody. I didn’t.' }], safe: ['clerk'], next: { turn: 'clerk_out' }, objective: 30, pressure: -3 }],
            mixed: [{ text: '{clerk.first} gets out, but the stockroom door swings shut behind {clerk.him} in the corner of the stream. The comments fill with it before {rider.first} turns around. {rider.He} {rider~reads|read} them, then {rider~looks|look} at the door for a long time.',
              safe: ['clerk'], mark: ['seen_back'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { turn: 'clerk_out' }, objective: 25, pressure: 4 }],
            adverse: [{ text: '{clerk.first} gets one step through the stockroom door and stops, with the case of water still in {clerk.his} arms, in the middle of the picture. {rider.first} sees {clerk.him} on the phone before {rider.he} {rider~sees|see} {clerk.him} in the room. {rider.He} {rider~fires|fire} into the ceiling tiles, and {clerk.first} drops to the floor where {clerk.he} {clerk~stands|stand}.',
              mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'threat' }, pressure: 14, civilian: -6 },
              { text: 'A panel of the ceiling light comes down with the tiles and lands a foot from {clerk.first}’s head.' }],
          } },
        { id: 'watch_feed', title: 'Watch the counter before you answer', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(ASK), minutes: 3, consequenceLevel: 'moderate',
          certBonus: SURVEILLANCE,
          summary: '{lead} lets the callback ring out while your squad watches the counter from the corner, glass in front and the stream on a tablet beside it. You see the room two ways, the way {rider.first} wants it seen and the way it is. {rider.first} sees an unanswered phone and four hundred people asking why.',
          pull: 'See the room before you say a word into it.',
          cost: 'An unanswered phone, on camera, with the chat asking why.',
          preview: { favorable: 'You see the handgun, the floor and who looks where.', mixed: 'You see the counter, and the chat sees the police watching.', adverse: '{rider.first} takes the silence as the answer, and {manager.first} could pay for it.' },
          outcomes: {
            favorable: [
              { text: 'From the corner the team watches the counter for a full minute, the glass and the tablet side by side. The handgun is in {rider.first}’s right hand, finger off the trigger, pointed at the floor. {manager.first} looks at the stockroom door every few seconds, at {clerk.first}, and away again before {rider.first} can follow the look.',
                reveal: ['handgun'], mark: ['glance', 'looked'], moves: { rider: 'contact' }, next: { node: 'on_air' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'The squad’s sharpest pair of eyes notices the whiteboard by the register. One pickup time is wiped out with a thumb.' },
            ],
            mixed: [{ text: 'The team sees the counter, the handgun and {manager.first} on the floor. So does the chat, which spots a helmet at the corner in the background of the stream. {rider.first} waves at the camera and asks the police to say hi.',
              reveal: ['handgun'], mark: ['performing', 'looked'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 4, pressure: 4 }],
            adverse: escalate({
              lead: 'The callback rings out on the stream, eleven times, in front of everyone. {rider.first} decides that is the answer.',
              threat: '{rider.first} raises the handgun at {manager.first} and tells the camera the police had their chance.',
              quiet: '{rider.first} silences the ringing and talks only to the comments from then on.',
              quietNext: { node: 'on_air' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the stream is up
    { id: 'on_air', stage: 'adapt',
      threat: { label: 'The comments turn', minutes: 11, text: 'The comments start to turn. People ask why {rider.first} needs a handgun if {rider.he} didn’t take anything, and {rider.first} reads every one of them out loud.', pressure: 5, mark: ['turned_chat'], moves: { rider: 'provoked' }, bump: { stream: 10 },
        beats: [
          { id: 'friend_types', at: 1.4, by: 'rider', line: '{friend.first} says come out, I got you. {friend.first}, I can’t.' },
          { id: 'count_two', at: 2.8, by: 'radio', line: 'Stream just passed two thousand. A {outlet_short} van is two blocks out.', bump: { stream: 6 } },
          { id: 'manager_asks', at: 3.9, by: 'manager', line: 'Can I stand up? My knees, {rider.first}.', moves: { rider: 'contact' } },
        ] },
      prompt: 'The phone is still propped against the register, and the count under the picture keeps climbing. {rider.first} stands between the camera and {manager.first}, close enough to touch the screen. {rider.He} {rider~wants|want} {manager.first} to say one sentence to it.',
      exchange: [{ by: 'rider', line: 'Tell them. Tell them what you told {delivery_app}.' }, { by: 'manager', line: 'Not with that in your hand.' }],
      promptIf: [
        { when: { marks: ['terms'] }, prompt: '{rider.first} has said what {rider.he} {rider~wants|want}, out loud, for the stream. One sentence from {manager.first}, then {rider.he} {rider~walks|walk}. {manager.first} hasn’t said anything since.' },
        { when: { marks: ['glance'] }, prompt: 'Through the glass, {manager.first} keeps looking at the stockroom door, and on the tablet the count under the picture keeps climbing.' },
      ],
      choices: [
        { id: 'manager_speaks', title: 'Let {manager.first} answer on camera', icon: 'radio', talksTo: 'manager', check: check(TALK, 4), minutes: 3, consequenceLevel: 'high',
          modifiers: [{ label: 'You saw who {manager.he} {manager~watches|watch}', mark: 'glance', value: 6 }],
          summary: '{lead} asks {rider.first} to let {manager.first} stand up and answer, there and then, on the stream. Nobody knows what {manager.first} will say. Whatever it is, two thousand people hear it before you do, and {rider.first} is holding the handgun while they hear it.',
          pull: 'The sentence {rider.first} came for, said before anyone frames it.',
          cost: 'Whatever {manager.first} says goes out live before you can weigh it.',
          preview: { favorable: '{manager.first} answers, plainly, and the call turns on what {manager.he} {manager~says|say}.', mixed: '{manager.first} starts to answer and {rider.first} cuts {manager.him} off.', adverse: '{manager.first} says the wrong thing on camera, and the handgun could come up at {manager.him}.' },
          outcomes: {
            favorable: [
              { if: CLEAR, text: '{manager.first} gets up by the cooler handle and faces the phone. {manager.He} {manager~says|say} it in one breath, and then {manager~looks|look} at the stockroom door, and the whole stream watches {manager.him} look.',
                exchange: [{ by: 'manager', line: 'You didn’t take it. I knew you didn’t.' }], reveal: ['rider_clear'], mark: ['admitted'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -6 },
              { if: TOOK, text: '{manager.first} gets up by the cooler handle and faces the phone. {manager.He} {manager~speaks|speak} quietly, to the camera and not to {rider.first}. The comments stop for almost ten seconds. Then they start again, faster, and {rider.first} doesn’t read any of them out.',
                exchange: [{ by: 'manager', line: 'I watched you come back for it. From the door.' }], reveal: ['rider_clear'], mark: ['exposed'], moves: { rider: 'provoked' }, bump: { stream: 15 }, next: { node: 'cornered' }, objective: 10 },
            ],
            mixed: [{ text: '{manager.first} gets as far as {rider.first}’s name before {rider.first} talks over {manager.him}, then talks to the camera about the timestamp, the red light, the two blocks. Not yet, {rider.he} {rider~says|say}. Not like this.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: '{manager.first} stands up and says {rider.first} should be ashamed, in front of all these people. The chat explodes.',
              threat: '{rider.first} brings the handgun up level with {manager.first}’s chest, and the stream shows it to everyone.',
              quiet: '{rider.first} shoves {manager.first} back down to the floor and turns the camera to show {manager.him} there.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 18 }, pressure: 10 } }),
          } },
        { id: 'camera_wall', title: 'Ask {rider.him} to turn the camera to the wall', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} asks {rider.first} to turn the phone toward the wall and keep the sound on, so the people watching can hear and nobody can perform. You are asking {rider.first} to trust you over two thousand strangers who already believe {rider.him}, and they will watch the picture go to plaster.',
          pull: 'The count slows, and {rider.first} talks to you instead of to them.',
          cost: '{rider.first} gives up the witnesses {rider.he} came here for, on your word.',
          preview: { favorable: 'The camera faces the wall, and {rider.first} talks to you.', mixed: 'The camera turns, and turns back when the comments object.', adverse: '{rider.first} refuses to turn the camera and could point the handgun at {manager.first}.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} looks at the phone for a while. Then {rider.he} {rider~turns|turn} it to face the wall by the register, where a calendar from the supplier hangs. The sound stays on. The comments keep scrolling, unread, and {rider.first} starts answering the negotiator in a lower voice.',
                mark: ['phone_wall'], moves: { rider: 'contact' }, next: { node: 'way_out' }, objective: 15, pressure: -5 },
              { when: { lead: ['steady'] }, text: 'The negotiator doesn’t speed up once, even when the comments start shouting through the speaker.' },
            ],
            mixed: [{ text: '{rider.first} turns the phone to the wall. Thirty seconds later the speaker is full of people asking what happened, and {rider.he} {rider~turns|turn} it back, and {rider~apologizes|apologize} to them, not to the negotiator.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 6 }, next: { node: 'way_out' }, objective: 6 }],
            adverse: escalate({
              lead: '{rider.first} hears the request as the next thing the police will take away and says so, to the camera, in detail.',
              threat: 'Then {rider.he} {rider~points|point} the handgun at {manager.first} and asks the stream what they think the police will do now.',
              quiet: '{rider.first} props the phone higher on the register, so it sees more of the room.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
          } },
        // Command can end the stream; the rider can't stop it, and will know who did.
        { id: 'cut_feed', title: 'Have command take the stream down', icon: 'handover', check: check(PRESS, 2), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
          summary: 'Command asks {stream_app} to end {rider.first}’s stream, and your squad waits on a company two time zones away. When it goes, it goes in front of {rider.first}, mid-sentence. Two thousand people lose the picture {rider.he} came here to give them, and {rider.first} will know who closed it.',
          pull: 'No audience to perform for, and no count climbing.',
          cost: '{rider.first} watches the screen go black and knows who did it.',
          preview: { favorable: 'The stream ends, and {rider.first} has only you to talk to.', mixed: 'The stream ends and comes back on another phone, faster.', adverse: '{rider.first} sees the stream end and could press the handgun against {manager.first}.' },
          outcomes: {
            favorable: [{ text: 'The stream drops while {rider.first} is mid-sentence. {rider.He} {rider~taps|tap} the phone, then the counter, then {rider~picks|pick} up the callback on the first ring and {rider~asks|ask} for it back. {rider.He} {rider~doesn’t|don’t} shout.',
              exchange: [{ by: 'rider', line: 'Put it back. Put it back and I’ll talk.' }], mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 10, pressure: 4 }],
            mixed: [{ text: 'The stream goes black. {rider.first} makes {clerk.first} hand over the phone from {clerk.his} apron, and ninety seconds later the stream is back on it. The old viewers are hunting for it, and the count climbs faster than the first time.',
              exchange: [{ by: 'rider', line: 'You can’t turn off two phones.' }], mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'way_out' }, objective: 4, pressure: 6 }],
            adverse: escalate({
              lead: '{rider.first} watches the stream die on the screen and turns slowly to the window where the squad stands.',
              threat: '{rider.first} drags {manager.first} up by the collar and puts the handgun to {manager.his} side, in the window, for nobody.',
              quiet: '{rider.first} sweeps the phone off the counter and stands over {manager.first}, breathing hard, not answering.',
              extra: { mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
          } },
        // The same act as watching from the corner, so not after it.
        { id: 'team_glass', title: 'Move your squad up to the glass', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE), minutes: 3, consequenceLevel: 'moderate', onlyIf: { notMarks: ['looked'] },
          certBonus: SURVEILLANCE,
          summary: '{lead} moves your squad up to the front glass, close enough to reach {manager.first} in seconds and to see exactly where the handgun is. The stream sees it too. Two thousand people watch helmets arrive at the window, and so does {rider.first}.',
          pull: 'Close enough to reach {manager.first}, and eyes on the handgun.',
          cost: 'The stream watches your squad move in, and {rider.first} watches the stream.',
          preview: { favorable: 'Your squad is at the glass with eyes on the handgun.', mixed: 'Your squad is at the glass, and the stream is full of it.', adverse: '{rider.first} spots your squad and could pull {manager.first} against the window with the handgun.' },
          outcomes: {
            favorable: [
              { text: 'The squad settles at either side of the front glass without a sound anyone inside could name. The handgun is in {rider.first}’s right hand, low. {manager.first} is a few steps from the door. The stream shows the street and nothing on it.',
                reveal: ['handgun'], mark: ['team_close'], next: { node: 'way_out' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'The squad’s sharpest pair of eyes counts the steps from the cooler to the door. Four.' },
            ],
            mixed: [{ text: 'The squad gets to the glass, and a helmet shows at the edge of the picture. The chat sees it first. {rider.first} reads it out and stands closer to {manager.first}.',
              reveal: ['handgun'], mark: ['team_close', 'performing'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { node: 'way_out' }, objective: 6, pressure: 4 }],
            adverse: escalate({
              lead: 'Somebody in the chat posts a screenshot of helmets at the glass, and {rider.first} reads it out loud.',
              threat: '{rider.first} pulls {manager.first} up between {rider.himself} and the window, with the handgun pressed to {manager.his} side.',
              quiet: '{rider.first} backs behind the counter with {manager.first} and won’t come near the glass again.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['team_close', 'performing'], moves: { rider: 'team_seen' }, bump: { stream: 16 }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the stream is down
    { id: 'off_air', stage: 'adapt',
      threat: { label: '{rider.first} stands over {manager.first}', minutes: 12, text: '{rider.first} stops pacing and stands over {manager.first}, close, and asks {manager.him} the same question again and again in the same flat voice.', pressure: 6, moves: { rider: 'provoked' },
        beats: [
          { id: 'stops_twice', at: 1.5, by: 'radio', line: 'Window. Subject stopped by the manager again. Second time.' },
          { id: 'no_one', at: 3.1, by: 'rider', line: 'Nobody can see this now. You get that?' },
        ] },
      prompt: 'There is no stream now, and no count. {rider.first} paces the length of the counter, and every time {rider.he} {rider~passes|pass} {manager.first} {rider.he} {rider~stops|stop}. The store is quiet enough to hear the cooler hum.',
      exchange: [{ by: 'rider', line: 'Now it’s just us. That what you wanted?' }, { by: 'negotiator', line: 'I wanted to hear you without four hundred people in the way.' }],
      promptIf: [
        { when: { marks: ['cut'] }, prompt: 'Command took the stream down. {rider.first} keeps picking up the dead phone and putting it back against the register, as if the picture might come back on its own.',
          exchange: [{ by: 'rider', line: 'You did that. You took them away.' }, { by: 'negotiator', line: 'I did. I want to hear you without them.' }] },
        { when: { notSafe: ['clerk'] }, prompt: 'No stream, no count. {rider.first} paces between {manager.first} on the floor and {clerk.first}, still frozen by the stockroom door with the case of water.' },
      ],
      choices: [
        { id: 'own_it', title: 'Tell {rider.him} it was you', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
          summary: '{lead} tells {rider.first} plainly that the police took the stream down, and why, and doesn’t apologize. No trick and no bargain. {rider.first} has nobody watching now but you, and the honest answer might be the first thing anyone has told {rider.him} straight since Tuesday. Or the last thing {rider.he} {rider~wants|want} to hear.',
          pull: 'The truth, to someone who has had none since Tuesday.',
          cost: '{rider.first} hears that you took away the only people on {rider.his} side.',
          preview: { favorable: '{rider.first} talks to you, and {manager.first} could walk out.', mixed: '{rider.first} believes you and hates it.', adverse: '{rider.first} hears an enemy, and {manager.first} is the one in reach.' },
          outcomes: {
            favorable: [{ text: '{rider.first} is quiet for long enough that the team checks the line. Then {rider.he} {rider~says|say} nobody has told {rider.him} anything straight since {delivery_app} did. {rider.He} {rider~tells|tell} the negotiator about the red light and the timestamp, slowly, the way {rider.he} must have told it to the stream a hundred times. Then, without being asked, {rider.he} {rider~tells|tell} {manager.first} to get up and go. {manager.first} goes.',
              safe: ['manager'], mark: ['terms', 'still_armed'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
              clerkToo('{clerk.first} goes out the front with {manager.him}.'),
              { when: { lead: ['calm_voice'] }, text: 'Near the end {rider.first} says the negotiator is the first person since Tuesday who didn’t sound like a form.' }],
            mixed: [{ text: '{rider.first} believes the negotiator. That is the problem. {rider.He} {rider~says|say} the police are just like {delivery_app}, a message you can’t answer, and {rider~goes|go} back to pacing. But {rider.he} {rider~keeps|keep} the line open.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} drops the phone on the counter and says the negotiator is the last voice {rider.he} {rider~wants|want} to hear.',
              threat: 'Then {rider.he} {rider~kneels|kneel} beside {manager.first} and puts the handgun against {manager.his} shoulder.',
              quiet: 'The line stays open, and nobody speaks on it.',
              quietNext: { node: 'way_out' },
              extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
          } },
        // Off the stream the squad can move unseen, and the rider just said why that frightens them.
        { id: 'move_up_dark', title: 'Move your squad up while nobody films', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE, 2), minutes: 4, consequenceLevel: 'moderate',
          certBonus: SURVEILLANCE,
          summary: '{lead} walks your squad up the dark sidewalk to the store while no stream can show it, near enough to get a hand on {manager.first} through the door. {rider.first} just said nobody can see this now. One helmet in the dark glass, and {manager.first} is the person beside {rider.him}.',
          pull: 'A hand on {manager.first} at the door, and nobody filming the move.',
          cost: '{rider.first} could catch a helmet in the glass, with {manager.first} in reach.',
          preview: { favorable: 'Your squad reaches the door unseen, with eyes on the handgun.', mixed: '{rider.first} catches one helmet in the dark and stops over {manager.first}.', adverse: '{rider.first} sees helmets with no camera on, and the handgun could turn on {manager.first}.' },
          outcomes: {
            favorable: [
              { text: 'The squad comes up the sidewalk in the dark and splits to both sides of the door. The handgun hangs at {rider.first}’s side. {manager.first} is on the floor by the cooler, looking toward the stockroom every time {rider.first} turns away.',
                reveal: ['handgun'], mark: ['team_close'], next: { node: 'way_out' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'The squad’s best spotter reads the whiteboard by the register through the glass. One pickup time on it has been smudged off.' },
            ],
            mixed: [{ text: 'The squad reaches the glass, and the edge of a helmet catches the light from the drinks cooler. {rider.first} stops over {manager.first} and asks the negotiator who is at the window.',
              reveal: ['handgun'], mark: ['team_close'], moves: { rider: 'team_seen' }, next: { node: 'way_out' }, objective: 6, pressure: 4 }],
            adverse: escalate({
              lead: '{rider.first} sees two helmets in the dark glass and stops pacing. {rider.He} {rider~says|say} nobody is filming now, so nobody will see what happens next.',
              threat: '{rider.first} hauls {manager.first} up off the floor and holds the handgun to {manager.his} side, facing the window.',
              quiet: '{rider.first} kills the lights inside and stands in the dark by the register.',
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
        ] },
      prompt: '{clerk.first} is behind the patrol car with a blanket on {clerk.his} shoulders and {clerk.his} eyes on the stream on an officer’s phone. {clerk.He} {clerk~keeps|keep} saying {clerk.he} didn’t say anything to anybody. Nobody asked {clerk.him} to.',
      exchange: [{ by: 'negotiator', line: 'What didn’t you say?' }, { by: 'clerk', line: 'About the bag. About that night.' }],
      promptIf: [{ when: { marks: ['seen_back'] }, prompt: '{clerk.first} is out, and the stream saw the stockroom door move. {rider.first} keeps asking the comments where the kid went.',
        exchange: [{ by: 'rider', line: 'They took the kid. What else are they doing back there?' }, { by: 'clerk', line: 'I didn’t say anything about the bag.' }] }],
      choices: [
        { id: 'clerk_asked', title: 'Ask {clerk.first} about the bag', icon: 'search', talksTo: 'clerk', check: check(ASK, -2), minutes: 4,
          summary: '{lead} sits on the patrol car bumper next to {clerk.first} and asks what happened at the register at 11:40. {clerk.first} is nineteen and shaking, and the answer might be the one {rider.first} came for. It might be the one {clerk.first} can’t take back.',
          pull: 'The answer to the only question that started this.',
          cost: '{clerk.first}, nineteen, answering it with the stream playing beside {clerk.him}.',
          preview: { favorable: 'You hear what happened at the register at 11:40.', mixed: '{clerk.first} starts to answer and asks for {manager.first} instead.', adverse: '{clerk.first} shuts down, and the stream goes on without you.' },
          outcomes: {
            favorable: [
              { if: CLEAR, text: '{clerk.first} says it to the bumper, not to the negotiator. {clerk.He} took the bag. {clerk.He} {clerk~was|were} hungry and the drop was late, and {manager.first} found the receipt in {clerk.his} apron the next day and called {delivery_app} about the rider instead.',
                exchange: [{ by: 'clerk', line: '{manager.He} said they’d never fire me if it was the rider.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'way_out' }, objective: 15 },
              { if: TOOK, text: '{clerk.first} says {rider.first} came back at 11:50, after the drop failed, and took the bag off the counter while {clerk.he} {clerk~was|were} in the stockroom. {clerk.He} watched it on the store camera. {manager.first} kept the clip.',
                exchange: [{ by: 'clerk', line: 'I didn’t say anything. I didn’t want {rider.him} to get in trouble.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'way_out' }, objective: 12 },
            ],
            mixed: [{ text: '{clerk.first} gets as far as the register and stops. {clerk.He} {clerk~asks|ask} for {manager.first}, then for {clerk.his} phone, then whether {manager.first} is going to be all right.',
              next: { node: 'way_out' }, objective: 6 }],
            adverse: [{ text: '{clerk.first} pulls the blanket over {clerk.his} head and won’t talk to anyone. On the officer’s phone, the stream counts past three thousand.',
              bump: { stream: 10 }, next: { node: 'way_out' }, objective: 3, pressure: 4 }],
          } },
        // The temptation (dilemma pattern 15): a story that ends the stand-off, if it is true.
        { id: 'say_clerk_backs', title: 'Tell {rider.him} {clerk.first} backs {rider.him}', icon: 'radio', talksTo: 'rider', deceives: true, check: check(TALK, 4), minutes: 2, consequenceLevel: 'high',
          summary: '{lead} tells {rider.first} that {clerk.first} is outside and saying {rider.first} didn’t take the bag. Nobody has asked {clerk.first} that. It is the sentence {rider.first} came for, offered before anyone knows if it is true. If it isn’t, {rider.first} hears that too, on the stream.',
          pull: 'The words {rider.first} came for, before anyone else has to say them.',
          cost: 'A promise the team can’t check, and two thousand people who will.',
          preview: { favorable: 'Once {rider.first} hears it, {rider.he} {rider~starts|start} talking about walking out.', mixed: '{rider.first} wants to hear it from {clerk.first}.', adverse: '{rider.first} finds out the story isn’t true, live, and the handgun could come up.' },
          outcomes: {
            favorable: [{ text: '{rider.first} asks the negotiator to say it again, slower, and then says it to the camera {rider.himself}. {rider.His} voice goes up at the end, like a question. For the first time since your squad arrived, {rider.he} {rider~sits|sit} down.',
              promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'released' }, next: { node: 'way_out' }, objective: 15, pressure: -8 }],
            mixed: [{ text: '{rider.first} wants {clerk.first} to say it, on the stream, in {clerk.his} own voice. The negotiator says {clerk.first} is with the medic. {rider.first} says {rider.he} {rider~can|can} wait.',
              promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: 'A comment comes up on the stream from {clerk.first}’s own account, typed in the back of the patrol car. Nobody told {clerk.him} to stop. {rider.first} reads it out loud.',
              threat: '{rider.first} turns the handgun on {manager.first} and tells the camera this is what the police do.',
              quiet: '{rider.first} stops talking to the negotiator at all.',
              quietNext: { node: 'way_out' },
              extra: { mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'way_out', stage: 'resolve',
      threat: { label: 'The {outlet_short} van parks', minutes: 12, text: 'A {outlet_short} van parks at the corner, and its crew raises a light on the front door. {rider.first} watches it from behind the counter.', pressure: 5, bump: { stream: 18 },
        beats: [
          { id: 'medic', at: 1.8, by: 'radio', line: 'Medic staged at the corner. Ready when you are.' },
          { id: 'how_out', at: 3.4, by: 'rider', line: 'If I walk out, do I walk out on camera? Yes or no.', bump: { stream: 5 } },
          { id: 'camera_door', at: 4.6, by: 'radio', line: 'Van crew has a camera on the front door. Lights up.', bump: { stream: 4 } },
        ] },
      prompt: '{rider.first} is talking about coming out now, but not about how. The phone is still on the register. {manager.first} is still on the floor by the cooler, and outside a camera on the corner is pointed at the door.',
      exchange: [{ by: 'rider', line: 'I come out on camera or I don’t come out.' }, { by: 'negotiator', line: 'Tell me why the camera matters.' }, { by: 'rider', line: 'Because then you can’t say what happened.' }],
      promptIf: [
        { when: { marks: ['admitted'] }, prompt: '{manager.first} said it on camera. The comments haven’t stopped since. {rider.first} keeps looking at the number, and at the door, and at the stockroom.',
          exchange: [{ by: 'rider', line: 'You heard it. Everybody heard it.' }, { by: 'negotiator', line: 'Everybody heard it. Now let’s get you out.' }] },
        { when: { marks: ['exposed'] }, prompt: 'The stream heard {manager.first} say it, and {rider.first} has stopped arguing with the comments. {rider.He} {rider~talks|talk} about coming out like someone talking about a place {rider.he} {rider~has|have} never been.',
          exchange: [{ by: 'rider', line: 'If I walk out, they all watch me walk out.' }, { by: 'negotiator', line: 'Then they watch you walk out. That’s all they see.' }] },
        { when: { marks: ['news_on'] }, prompt: '{outlet} is carrying the stream now. {rider.first} is talking about coming out, but {rider.his} eyes keep going to the number, which has gained a digit since the repost.' },
        { when: { marks: ['phone_wall'] }, prompt: 'The phone faces the calendar on the wall, and the speaker murmurs with comments nobody reads. {rider.first} talks to the negotiator now, mostly.' },
        { when: { marks: ['lied_clerk'] }, prompt: '{rider.first} believes {clerk.first} is on {rider.his} side. {rider.He} {rider~keeps|keep} asking when {clerk.first} will say it on the stream.' },
      ],
      choices: [
        // Not after command cut the stream: there is no stream to walk out on.
        { id: 'walk_live', title: 'Let {rider.him} walk out on the stream', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, 0), minutes: 6, onlyIf: { notMarks: ['lie_found', 'cut'] },
          modifiers: [{ label: 'The camera is on the wall', mark: 'phone_wall', value: -4 }],
          favors: [STEADY_ON_CAMERA],
          summary: '{lead} agrees that {rider.first} walks out with the phone filming, so everyone watching can see nobody hurt {rider.him} after. {manager.first} goes first. Every step your squad takes is on thousands of phones and the {outlet_short} camera, and {rider.first} has never been more watched.',
          pull: '{rider.first} walks out the way {rider.he} {rider~asks|ask}, where nobody can lie about it.',
          cost: 'Every move your squad makes, live, with the {outlet_short} camera on the door.',
          preview: { favorable: '{manager.first} comes out first. {rider.first} follows, still filming, with the handgun left inside.', mixed: '{manager.first} walks out, and {rider.first} sees the camera and backs inside, armed.', adverse: '{rider.first} performs for the camera at the door, and the handgun comes up with it.' },
          outcomes: {
            favorable: [
              { text: '{manager.first} goes out first, holding the door frame. Then {rider.first} walks out holding the phone up in front of {rider.him}, filming {rider.his} own empty right hand, the way the negotiator tells {rider.him} to. Two officers take {rider.him} on the sidewalk in front of the {outlet_short} camera, slowly, while the stream’s count climbs higher than it has all night.',
                safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 75, pressure: -12 },
              clerkToo('{clerk.first} comes out of the stockroom a minute before, with nobody filming.'),
            ],
            mixed: [
              { text: '{manager.first} gets out. On the step {rider.first} sees the van’s light come up on the corner and backs inside with the phone held high. The handgun is back in {rider.his} hand by the register.',
                safe: ['manager'], mark: ['still_armed', 'performing'], bump: { stream: 12 }, next: { node: 'last_word' }, objective: 40, pressure: 4 },
              foundOut('Then a comment comes up under the picture from {clerk.first}’s own account. It says {clerk.first} never told anyone {rider.first} was clear. {rider.first} reads it out loud twice.', { if: TOOK }),
              clerkToo('{clerk.first} is out first.'),
            ],
            adverse: escalate({
              lead: 'At the door {rider.first} stops and turns the phone around, onto {rider.himself}, and starts to tell the stream what the police will do to {rider.him} next.',
              threat: '{rider.first} raises the handgun for the camera, and the people behind {rider.him} are {manager.first} and the open door.',
              anyway: 'The comments are screaming. {rider.first} turns from the door with the handgun up and puts it on {manager.first}.',
              quiet: '{rider.first} backs inside and closes the door on the street, still filming.',
              quietNext: { node: 'last_word' },
              extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 20 }, pressure: 10 } }),
          } },
        { id: 'walk_dark', title: 'Phone face down, then walk', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, 1), minutes: 5,
          modifiers: [{ label: 'The camera is already on the wall', mark: 'phone_wall', value: 6 }, { label: '{rider.first} is playing to the chat', mark: 'performing', value: -5 }],
          favors: [CALM_ON_CAMERA],
          summary: '{lead} asks {rider.first} to put the phone face down on the register before anyone moves, then walk out to your squad with nobody watching but your squad. It is the quiet way out. It asks {rider.first} to believe the people {rider.he} came here afraid of, with no witnesses at all.',
          pull: 'No audience, no show, nothing to perform at the door.',
          cost: '{rider.first} walks out to the police with nobody watching, on your word alone.',
          preview: { favorable: '{rider.first} sets the phone down and walks out to you.', mixed: '{rider.first} comes out, but only after the comments argue for an hour.', adverse: '{rider.first} won’t put the phone down, and stays behind the counter with {manager.first}.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} sets the phone face down on the register, then the handgun next to it. {manager.first} walks out first without being told. {rider.first} comes out a minute later with {rider.his} hands open and asks the first officer to make sure somebody tells {friend.first}.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 75, pressure: -12 },
              clerkToo('{clerk.first} slips out the back while the phone is face down.'),
            ],
            mixed: [
              { text: '{rider.first} picks the phone up and puts it down six times, reading the comments every time. It is past one in the morning when {rider.he} {rider~lets|let} {manager.first} go and follows {manager.him} out with nothing in {rider.his} hands.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 60, minutes: 40 },
              clerkToo('{clerk.first} is let out the back in the meantime.'),
            ],
            adverse: heldEnd({ text: '{rider.first} says {rider.he} {rider~knows|know} what happens to people nobody is filming, and sits down behind the counter beside {manager.first}, the phone in one hand and the handgun in the other.', moves: { rider: 'provoked' }, objective: 10 },
              '{clerk.first} is still by the stockroom door.'),
          } },
        // The lie found out (temptation). Only on the branch where the team said the clerk backs the rider.
        { id: 'own_lie', title: 'Tell {rider.him} the truth about {clerk.first}', icon: 'radio', talksTo: 'rider', check: check(TALK, 0), minutes: 4, onlyIf: { marks: ['lied_clerk'], notMarks: ['lie_found'] },
          summary: '{lead} tells {rider.first} that nobody asked {clerk.first} anything before the team said {clerk.first} backed {rider.him}. It is the right thing to say, and the worst moment to say it, with the {outlet_short} van parked at the corner and {rider.first} sitting down for the first time all night.',
          pull: 'Take back a promise before it breaks on its own, live.',
          cost: '{rider.first} hears that the one good thing tonight was made up.',
          preview: { favorable: '{rider.first} takes it, and keeps talking to you.', mixed: '{rider.first} stands up again and asks the stream what to do.', adverse: '{rider.first} hears one more lie, and the handgun could come up at {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} doesn’t say anything for a while. Then {rider.he} {rider~says|say} at least somebody told {rider.him} the truth tonight, even if it was the police, and asks what {rider.he} {rider~has|have} to do to walk out.',
              breaks: ['clerk_backs'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 20 }],
            mixed: [{ text: '{rider.first} stands up and asks the stream whether {rider.he} should believe the police now. The comments answer in a hundred ways at once.',
              breaks: ['clerk_backs'], mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'last_word' }, objective: 10 }],
            adverse: escalate({
              lead: '{rider.first} says everybody lies to {rider.him}, {delivery_app}, the store, the police, and says it to the camera.',
              threat: '{rider.first} turns the handgun on {manager.first} and keeps it there.',
              anyway: '{rider.first} is shaking. {rider.He} {rider~points|point} the handgun at {manager.first} anyway.',
              quiet: '{rider.first} puts the phone in {rider.his} jacket, still streaming, and sits with {rider.his} back to the counter.',
              quietNext: { node: 'last_word' },
              extra: { breaks: ['clerk_backs'], mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
          } },
        // Only after the rider ended the stream and asked what happens to people who lie to everyone.
        { id: 'honest_next', title: 'Tell {rider.him} what happens next', icon: 'radio', walks: 'manager', talksTo: 'rider', check: check(TALK, -2), minutes: 5, onlyIf: { marks: ['ended_it'] }, certBonus: NEGOTIATOR,
          summary: '{lead} answers the question {rider.first} asked, straight. Nobody out here decides the charges, or whether {delivery_app} ever takes {rider.him} back, and {lead} won’t pretend otherwise. It is the first answer all night that isn’t a trick, and it isn’t a comfort either. {rider.first} keeps asking what happens after the officers take hold.',
          pull: 'The truth to someone who just stopped lying.',
          cost: 'An answer with nothing soft in it, to someone already on the floor.',
          preview: { favorable: '{rider.first} lets {manager.first} go and walks out to you.', mixed: '{rider.first} lets {manager.first} go and stays inside with the answer.', adverse: '{rider.first} hears there is nothing left, and stays behind the counter with {manager.first}.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} listens to all of it without a word. Then {rider.he} {rider~tells|tell} {manager.first} to go, and {manager.first} goes, and a minute later {rider.first} walks out after {manager.him} with empty hands and asks an officer whether {friend.first} is still outside.',
                safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 75, pressure: -10 },
              clerkToo('{clerk.first} is let out the back first.'),
            ],
            mixed: [
              { text: '{rider.first} tells {manager.first} to go. Then {rider.he} {rider~sits|sit} down behind the counter with the handgun beside {rider.him} and {rider~asks|ask} for a minute, just one.',
                safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} goes out with {manager.him}.'),
            ],
            adverse: heldEnd({ text: '{rider.first} says that is what {rider.he} thought, and sits down beside {manager.first} on the floor, and doesn’t say anything else for a long time.', objective: 10 },
              '{clerk.first} is still by the stockroom door.'),
          } },
        { id: 'wait_night', title: 'Hold the block and wait', icon: 'wait', check: check(HOLD, -2), minutes: 45, span: 'All night',
          summary: 'Command keeps the block shut and lets the night run. The stream will run with it, and the count, and the {outlet_short} van on the corner. {rider.first} gets as long as {rider.he} {rider~needs|need}. So does {manager.first}, on the floor by the cooler, the whole time.',
          pull: 'Time, which costs nothing you can see right now.',
          cost: '{manager.first} spends the night on the floor in front of a camera.',
          preview: { favorable: '{rider.first} lets {manager.first} go and comes out before dawn.', mixed: 'The door opens as it gets light.', adverse: 'The shift ends with {manager.first} still on the floor inside.' },
          outcomes: {
            favorable: [
              { text: 'Some time after three, {rider.first} turns the phone off. {rider.He} {rider~sends|send} {manager.first} out the front, {rider~waits|wait} until {manager.he} {manager~is|are} past the patrol car, and {rider~comes|come} out after {manager.him} with {rider.his} hands empty.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 55 },
              clerkToo('{clerk.first} comes out the back before them, with the case of water still in {clerk.his} arms.'),
            ],
            mixed: [
              { text: 'As the sky gets light, the stream ends on its own when the phone dies. {rider.first} lets {manager.first} go, and follows {manager.him} out.',
                safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 45, minutes: 30 },
              clerkToo('{clerk.first} is let out first.'),
            ],
            adverse: heldEnd({ if: CLEAR, text: 'The shift changes. {rider.first} is still behind the counter, the phone on charge from the register’s outlet.', objective: 10 },
              '{clerk.first} is still frozen by the stockroom door.', [CLEAR]).concat(
              heldEnd({ if: TOOK, text: 'The shift changes, and {rider.first} hasn’t moved. The phone is on charge from the register’s outlet, still streaming to a few hundred people who stayed up.', objective: 10 },
                '{clerk.first} is still frozen by the stockroom door.', [TOOK])),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3: exposed on camera (situation 2)
    { id: 'cornered', stage: 'resolve',
      threat: { label: 'The count keeps climbing', minutes: 13, text: 'The count passes five thousand. Somebody has clipped {manager.first}’s sentence and it is going around on its own, faster than the stream.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 15 },
        beats: [
          { id: 'thief', at: 1.2, by: 'radio', line: 'Comments are calling the subject a thief now. Lots of them.' },
          { id: 'rider_quiet', at: 2.6, by: 'rider', line: 'They were all on my side. Every one of them.' },
        ] },
      prompt: '{manager.first} said it on camera, and the stream heard it. {rider.first} isn’t reading the comments anymore. {rider.He} {rider~stands|stand} at the register looking at the phone, not at {manager.first}, the handgun hanging at {rider.his} side.',
      exchange: [{ by: 'negotiator', line: 'Are you thinking about hurting yourself?' }, { by: 'rider', line: 'I’m thinking everybody saw that.' }],
      choices: [
        { id: 'off_camera', title: 'Get {rider.him} off the stream now', icon: 'radio', talksTo: 'rider', check: check(HOLD, 2), minutes: 5, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{lead} asks {rider.first} to end the stream, now, {rider.himself}, and talk to one person instead of five thousand. The audience that kept {rider.first} going all night has turned on {rider.him}. Ending it is the kindest thing anyone can do tonight, and the hardest thing to ask.',
          pull: 'Take the turned crowd out of the room.',
          cost: '{rider.first} ends the stream with five thousand people calling {rider.him} a thief.',
          preview: { favorable: '{rider.first} ends the stream and keeps talking to you.', mixed: '{rider.first} ends it, and the silence is worse.', adverse: '{rider.first} won’t look away from the comments, and the handgun comes up.' },
          outcomes: {
            favorable: [{ text: '{rider.first} ends the stream {rider.himself}, with one thumb, in the middle of a comment. Then {rider.he} {rider~sets|set} the phone down on the register and {rider~asks|ask} the negotiator, very quietly, what happens to people who lie to everyone.',
              stabilize: ['stream'], mark: ['ended_it'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -10 }],
            mixed: [{ text: '{rider.first} ends the stream. Then {rider.he} {rider~stands|stand} in the quiet store with nothing to say to anybody, for a long time.',
              stabilize: ['stream'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 }],
            adverse: escalate({
              lead: '{rider.first} keeps scrolling. The comments are the only thing {rider.he} {rider~looks|look} at.',
              threat: 'Then {rider.he} {rider~raises|raise} the handgun at {manager.first}, as if {manager.first} wrote all of them.',
              anyway: '{rider.first} turns on {manager.first} with the handgun up, saying {manager.he} did this.',
              quiet: '{rider.first} sits down on the floor and holds the phone against {rider.his} chest.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
        { id: 'friend_stays', title: 'Ask {rider.him} who should take the scooter home', icon: 'radio', talksTo: 'rider', check: check(TALK, -2), minutes: 5,
          summary: '{lead} asks {rider.first} who should take the scooter home tonight, and says {friend.first} is waiting at the patrol line with it. The comments keep replaying the accusation while you ask about tomorrow. A question about tomorrow can sound like a trick to someone who thinks there isn’t one.',
          pull: 'Something after tonight that {rider.first} can still decide.',
          cost: 'Talk of tomorrow, while five thousand people call {rider.first} a thief.',
          preview: { favorable: '{rider.first} answers about the scooter, and lets {manager.first} go.', mixed: '{rider.first} answers about the scooter and nothing else.', adverse: '{rider.first} hears a trick and turns the handgun toward {manager.first}.' },
          outcomes: {
            favorable: [{ text: '{rider.first} says {friend.first} should take it, and the key is in the seat. {rider.He} {rider~asks|ask} the negotiator to tell {friend.first} to wait. The negotiator says {friend.first} is already waiting.',
              exchange: [{ by: 'rider', line: 'Key’s under the seat. Tell {friend.first} not to leave.' }], safe: ['manager'], mark: ['friend_promise', 'still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 40 },
              { text: 'Then {rider.first} tells {manager.first} to get up and go, without looking at {manager.him}.' },
              clerkToo('{clerk.first} goes out the front behind {manager.him}.')],
            mixed: [{ text: '{rider.first} says the key is under the seat, and then nothing. {rider.He} {rider~keeps|keep} the line open and {rider~reads|read} the comments to {rider.himself}.',
              moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
            adverse: escalate({
              lead: '{rider.first} laughs at the word tomorrow and reads the next comment out loud.',
              threat: '{rider.first} turns and puts the handgun on {manager.first}, close.',
              anyway: '{rider.first} turns and puts the handgun on {manager.first}, though no one inside said a word.',
              quiet: '{rider.first} throws the phone across the floor. It lands face down, still live.',
              quietNext: { node: 'last_word' },
              extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3: the handgun is up
    { id: 'threat', stage: 'resolve',
      threat: { label: 'The {outlet_short} van goes live', minutes: 10, text: 'The {outlet_short} van goes live from the corner, and the stream’s count doubles in a minute. {rider.first} sees it happen on the screen.', pressure: 6, bump: { stream: 20 } },
      prompt: 'The handgun is pointed at {manager.first}, and the phone on the register is pointed at both of them. {manager.first} has gone still. {manager.His} eyes are on {rider.first}’s face, not the handgun.',
      exchange: [{ by: 'radio', line: 'Window. Handgun on the manager. Holding.' }, { by: 'manager', line: '{rider.first}. They’re all watching you.' }],
      promptIf: [
        { when: { notSafe: ['clerk'] }, prompt: 'The handgun is on {manager.first}. {clerk.first} is pressed against the stockroom door, still holding the case of water.' },
        { when: { marks: ['shot_inside'] }, prompt: 'There is a hole in the ceiling tiles and dust on the counter. The handgun is pointed at {manager.first} now, and the stream is still running.' },
      ],
      choices: [
        { id: 'talk_down', title: 'Talk {rider.him} down at the glass', icon: 'radio', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'rider' } }, talksTo: 'rider', check: check(TALK, 6), minutes: 3, stress: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          modifiers: [{ label: 'You know what happened at 11:40', mark: 'knows_truth', value: 6 }],
          summary: '{lead} steps up to the window in plain view and in line with the handgun, and says {rider.first}’s name. No phone, no stream. A face and a voice that hasn’t changed all night. If the handgun turns, it turns toward {lead}, on camera.',
          pull: 'The one voice that has been there all night, at the worst moment.',
          cost: '{lead} stands in line with the handgun, in front of the whole stream.',
          preview: { favorable: '{rider.first} sets the handgun down, and {manager.first} walks out first.', mixed: '{manager.first} gets out, and {rider.first} keeps the handgun.', adverse: 'Whoever stands at the window may be hit if {rider.first} fires.' },
          outcomes: {
            favorable: [
              { text: '{rider.first} looks at the window, then at the phone, then at {manager.first}. {rider.He} {rider~sets|set} the handgun on the counter beside the phone, slowly, so the camera can see {rider.him} do it, and lets {manager.first} out first. {rider.He} {rider~follows|follow} on the negotiator’s word into the hands of two officers on the step.',
                safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 75, pressure: -12 },
              clerkToo('{clerk.first} is already out the back.'),
            ],
            mixed: [
              { text: '{manager.first} gets out the front door. {rider.first} backs away from the window with the handgun still in {rider.his} hand and the phone in the other.',
                safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} is out before {manager.him}.'),
            ],
            adverse: [{ text: 'A shot goes through the front window as {rider.first} spins toward it. Glass catches the negotiator across the forearm on the way down behind the patrol car, and {manager.first} is still inside.', officer: 'wounded', fire: { from: 'rider' }, mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        { id: 'go_in', title: 'Send the team in', icon: 'shield', team: { to: 'scene', entry: 'rider' }, check: check(ENTER, 8), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'Your squad is already at the glass', mark: 'team_close', value: 8 }],
          summary: 'Your squad goes through the front door while {lead} keeps {rider.first} at the window. It is the fastest way to {manager.first}, on a live stream, and the one where anyone in that room can be badly hurt or die, {manager.first} first. Command approves it, and it goes to review whatever happens.',
          pull: 'Reach {manager.first} before {rider.first} decides.',
          cost: '{manager.first} could die in front of the camera, and so could {rider.first}.',
          preview: { favorable: 'You reach {manager.first} and get {manager.him} out.', mixed: '{manager.first} is out, hurt on the way.', adverse: '{rider.first} turns on {manager.first} as you come in. Either of them can be badly hurt, and {manager.first} could die.' },
          outcomes: {
            favorable: [
              { text: 'The team is through the door before {rider.first} turns. {manager.first} is out on the sidewalk, and the team has {rider.first}, the handgun out of reach. The phone on the register films the whole thing and keeps running.', safe: ['manager'], out: ['rider'], next: { ending: 'entry_clean' }, objective: 50 },
              clerkToo('{clerk.first} goes out ahead of {manager.him}.'),
            ],
            mixed: [
              { text: '{manager.first} falls hard against the cooler as the team pulls {manager.him} clear. The medic at the corner checks {manager.his} arm, and {rider.first} is taken.', safe: ['manager'], harm: { manager: 'wounded' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 35 },
              clerkToo('{clerk.first} is out first.'),
            ],
            adverse: [
              { if: CALM, text: '{rider.first} pulls {manager.first} down behind the register as the door gives. {manager.first} hits the floor hard, and {rider.first} lets go when the team reaches them.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
              { if: RAISED, text: '{rider.first} fires at {manager.first} as the door swings in, then turns toward the team.', reveal: ['raised'], harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
              { if: RAISED, text: '', fire: { from: 'rider' } },
              clerkToo('{clerk.first} slips out the back in the struggle.'),
            ],
          } },
        { id: 'go_dark', title: 'Kill the lights and the stream', icon: 'wait', check: check(MOVE, -2), minutes: 8,
          summary: 'Command cuts the power to {place} and takes the stream down with it, and every officer steps back out of sight. No picture, no count, nobody at the window to aim at. Also nobody close enough to help {manager.first} if it goes wrong in the dark.',
          pull: 'Take away the audience and the target in one move.',
          cost: 'Nobody is close enough to reach {manager.first} in the dark.',
          preview: { favorable: 'With no picture and nobody in view, the handgun comes down.', mixed: '{rider.first} puts the handgun down but won’t let {manager.first} go.', adverse: 'The handgun stays where it is in the dark, and nobody is close by if {rider.first} hurts {manager.first}.' },
          outcomes: {
            favorable: [
              { text: 'The lights go, the stream goes, and the street goes quiet but for the generator on the {outlet_short} van. After a minute {rider.first} calls out in the dark, asking where everybody went, and tells {manager.first} to go while nobody can see.', safe: ['manager'], mark: ['still_armed'], stabilize: ['stream'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} feels {clerk.his} way out with {manager.him}.'),
            ],
            mixed: heldEnd({ text: 'In the dark the handgun comes down, but {manager.first} isn’t let go. The block stays sealed.', stabilize: ['stream'], objective: 15 },
              '{clerk.first} stays pressed against the stockroom door.'),
            adverse: [
              ...heldEnd({ if: CALM, text: 'In the dark, the team can’t see where the handgun points. {rider.first} doesn’t answer anyone.', reveal: ['raised'], stabilize: ['stream'], pressure: 8 },
                '{clerk.first} is somewhere by the stockroom door.', [CALM]),
              { if: RAISED, text: 'When the emergency light comes on, {manager.first} is curled by the cooler, struck with the handgun in the dark. {rider.first} sends {manager.him} out the front, holding {manager.his} face, and sits down behind the counter.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, stabilize: ['stream'], next: { ending: 'manager_hurt_inside' }, objective: 10, pressure: 10 },
              clerkToo('{clerk.first} is waved out after {manager.him}.', { if: RAISED }),
            ],
          } },
      ] },
    { id: 'fired_on', stage: 'resolve',
      threat: { label: 'A call from home', minutes: 10, text: '{rider.first}’s phone lights up with a call from home. {rider.He} {rider~holds|hold} it up so the stream can see who is calling, and doesn’t answer it.', pressure: 8, bump: { stream: 15 } },
      prompt: 'The front window has a hole in it, and {rider.first} is behind the counter with {manager.first}. The phone is still propped on the register. Thousands of people just watched the shot.',
      exchange: [{ by: 'radio', line: 'Shot fired through the window. Nobody hit outside.' }, { by: 'rider', line: 'I didn’t mean it. I didn’t mean that.' }],
      choices: [
        { id: 'go_in', title: 'Go in now', icon: 'shield', team: { to: 'scene', entry: 'rider' }, check: check(ENTER, 12), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          summary: '{rider.first} has fired, and {manager.first} is in reach of {rider.him}. Your squad goes through the front now, on the stream, with every reason to and every risk of it. Anyone in that room can be badly hurt or die. It goes to review whatever happens.',
          pull: 'Reach {manager.first} before the next shot.',
          cost: '{manager.first} or {rider.first} could die in the doorway, on camera.',
          preview: { favorable: 'You get to {manager.first} first and bring {manager.him} out.', mixed: 'You bring {manager.first} out with an injury.', adverse: '{rider.first} fires again as you come in. Either of them can be badly hurt, and {manager.first} could die.' },
          outcomes: {
            favorable: [
              { text: 'Officers get there before {rider.first} can turn. {manager.first} is out on the street before {manager.he} {manager~knows|know} {manager.he} {manager~has|have} moved, and the team has {rider.first} on the floor, the handgun out of reach.', safe: ['manager'], out: ['rider'], next: { ending: 'entry_clean' }, objective: 45 },
              clerkToo('{clerk.first} goes out ahead of {manager.him}.'),
            ],
            mixed: [
              { text: '{manager.first} goes down against the cooler in the rush and comes out holding {manager.his} arm. Officers hold {rider.first}.', safe: ['manager'], harm: { manager: 'wounded' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 30 },
              clerkToo('{clerk.first} gets out first.'),
            ],
            adverse: [
              { if: CALM, text: '{rider.first} drags {manager.first} to the floor as officers come in. {manager.first} is badly hurt when they pull {manager.him} free, and {rider.first} lets go.', reveal: ['raised'], safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 15, civilian: -15 },
              { if: RAISED, text: '{rider.first} fires again, this time at {manager.first}, then swings toward the door.', reveal: ['raised'], harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
              { if: RAISED, text: '', fire: { from: 'rider' } },
              clerkToo('{clerk.first} slips out the back in the struggle.'),
            ],
          } },
        { id: 'hold_talk', title: 'Hold and keep {rider.him} talking', icon: 'radio', talksTo: 'rider', check: check(TALK, 8), minutes: 4, stress: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
          summary: '{rider.first} just said {rider.he} didn’t mean it. {lead} takes that and holds on to it, on the line, from behind the patrol car, while your squad holds the corners. If {rider.first} means it, this is how {manager.first} walks out. If {rider.he} {rider~doesn’t|don’t}, nobody is close.',
          pull: '{rider.first} just said {rider.he} didn’t mean it. Believe {rider.him}.',
          cost: 'Nobody is close to {manager.first} if the next shot is meant.',
          preview: { favorable: '{rider.first} lets {manager.first} go and puts the handgun down.', mixed: '{manager.first} gets out, and {rider.first} keeps the handgun.', adverse: '{rider.first} fires again, and {manager.first} is the one closest.' },
          outcomes: {
            favorable: [
              { text: 'The negotiator gets {rider.first} to say it again, and then to set the handgun on the counter, and then to tell {manager.first} to go. {rider.first} comes out a minute later with {rider.his} hands up and the phone still filming from the register behind {rider.him}.', safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 60 },
              clerkToo('{clerk.first} is already out the back.'),
            ],
            mixed: [
              { text: '{rider.first} lets {manager.first} out the front, and stays behind the counter with the handgun and the phone.', safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
              clerkToo('{clerk.first} goes with {manager.him}.'),
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
      threat: { label: '{rider.first} sits down', minutes: 13, text: '{rider.first} sits on the floor behind the counter, out of sight of the window, and turns the phone so it films the ceiling.', pressure: 4 },
      prompt: '{manager.first} is outside with the medic, in a gray blanket. {rider.first} is alone behind the counter with the phone and the count, and the only thing left to decide is how {rider.he} {rider~walks|walk} out of {place}.',
      exchange: [{ by: 'rider', line: 'Everybody’s waiting to see what I do.' }, { by: 'negotiator', line: 'Then let’s give them something boring.' }],
      promptIf: [
        { when: { notSafe: ['manager'] }, prompt: '{rider.first} is behind the counter with {manager.first} on the floor beside {rider.him}, and neither of them has spoken for a while.' },
        { when: { marks: ['still_armed'] }, prompt: '{manager.first} is clear. {rider.first} still has the handgun on the counter beside the phone.' },
      ],
      choices: [
        { id: 'out_front', title: 'Talk {rider.him} out the front', icon: 'radio', talksTo: 'rider', check: check(TALK, 4), minutes: 6,
          modifiers: [{ label: 'The handgun is still in reach', mark: 'still_armed', value: -8 }, { label: '{friend.first} is waiting outside', mark: 'friend_promise', value: 4 }],
          summary: '{lead} tells {rider.first} exactly how to come out, one step at a time, hands open, through the front door and past the {outlet_short} van and its camera. It is the plainest way out, and the most public. {friend.first} is out there.',
          pull: 'Simple instructions, in plain view.',
          cost: 'The {outlet_short} camera films {rider.first} walking out.',
          preview: { favorable: '{rider.first} walks out the front with empty hands.', mixed: '{rider.first} comes out, then goes silent at the camera.', adverse: '{rider.first} won’t walk out where the street can see, and stays behind the counter.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} steps out with {rider.his} hands open, the way the negotiator tells {rider.him}, and stops on the step to look for {friend.first} across the street. {friend.first} lifts a hand. Officers take {rider.first} by the arms.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 30 },
              { when: { notSafe: ['manager'] }, text: '{manager.first} goes out first, and {rider.first} follows with {rider.his} hands open. Officers take {rider.first} on the step.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 60 }],
            mixed: [{ when: { safe: ['manager'] }, text: '{rider.first} steps out with empty hands. At the {outlet_short} camera, {rider.he} {rider~stops|stop} answering the negotiator and won’t say another word. Two officers meet {rider.him} on the step.', moves: { rider: 'provoked' }, out: ['rider'], next: { ending: 'out_on_camera' }, objective: 25, minutes: 15 },
              { when: { notSafe: ['manager'] }, text: '{rider.first} lets {manager.first} go after twenty minutes at the glass, and comes out after {manager.him}.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 50, minutes: 15 }],
            adverse: [{ when: { safe: ['manager'] }, text: '{rider.first} isn’t walking out in front of a TV camera, {rider.he} {rider~says|say}, and sits back down behind the counter.', next: { ending: 'rider_held' }, objective: 5 },
              ...heldEnd({ when: MANAGER_IN, text: '{rider.first} won’t come out in front of the {outlet_short} van, or let {manager.first} go either.', objective: 5 }, '{clerk.first} is still by the stockroom door.', [], MANAGER_IN)],
          } },
        { id: 'out_back', title: 'Bring {rider.him} out through the stockroom', icon: 'door', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'rider' } }, talksTo: 'rider', check: check(TALK, 2), minutes: 5,
          modifiers: [{ label: 'The handgun is still in reach', mark: 'still_armed', value: -8 }],
          summary: '{lead} brings {rider.first} out the back, through the stockroom, away from the {outlet_short} van and its camera. It keeps {rider.his} face off the late broadcast. It also means walking out to the police with nobody watching, the one thing {rider.first} said {rider.he} wouldn’t do.',
          pull: 'Keep {rider.his} face off {outlet_short}.',
          cost: 'Out the back, unseen, the way {rider.first} was afraid of.',
          preview: { favorable: '{rider.first} comes out the back with nothing in {rider.his} hands.', mixed: '{rider.first} comes out the back, filming {rider.himself} the whole way.', adverse: '{rider.first} stops in the stockroom and goes back to the counter.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} comes out through the stockroom with open hands and leaves the phone on the case of water by the door. The team has {rider.him} before the end of the alley.', out: ['rider'], next: { ending: 'out_quiet' }, objective: 32 },
              { when: { notSafe: ['manager'] }, text: '{rider.first} lets {manager.first} out the front first, then walks out the back to the team with open hands.', safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 62 }],
            mixed: [{ when: { safe: ['manager'] }, text: '{rider.first} gives up in the alley, hands empty, filming the officers taking {rider.him} with the phone held at arm’s length.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 26 },
              { when: { notSafe: ['manager'] }, text: '{rider.first} sends {manager.first} out and comes out the back, filming every step of it.', safe: ['manager'], out: ['rider'], next: { ending: 'out_on_camera' }, objective: 55 }],
            adverse: [{ when: { safe: ['manager'] }, text: 'In the stockroom {rider.first} stops, says this is how it happens to people, and goes back to the counter.', next: { ending: 'rider_held' } },
              ...heldEnd({ when: MANAGER_IN, text: '{rider.first} goes back to the counter and sits beside {manager.first} again.' }, '{clerk.first} is still by the stockroom door.', [], MANAGER_IN)],
          } },
        { id: 'let_him_sit', title: 'Let {rider.him} decide', icon: 'wait', check: check(HOLD, -8), minutes: 45, span: 'All night',
          summary: 'Command keeps the block closed while {rider.first} decides when to come out. If {manager.first} is out, nobody is in danger in there now but {rider.first}. Your squad stays on the corner until morning if it takes until morning.',
          pull: 'Let time do it, now that the stream is all {rider.he} {rider~has|have}.',
          cost: 'Your squad holds a corner all night, and {rider.first} sits alone with the count.',
          preview: { favorable: '{rider.first} calls out that {rider.he} {rider~is|are} coming out.', mixed: 'The door opens near dawn.', adverse: 'The shift ends and {rider.first} hasn’t come out.' },
          outcomes: {
            favorable: [{ when: { safe: ['manager'] }, text: '{rider.first} turns the phone off, shouts through the door that {rider.he} {rider~is|are} done, and walks out to the team with {rider.his} palms showing.', out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 28 },
              { when: { notSafe: ['manager'] }, text: 'Some time after three, {rider.first} lets {manager.first} go, waits, and walks out after {manager.him} with {rider.his} palms showing.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 55 }],
            mixed: [{ when: { safe: ['manager'] }, text: 'As the sky gets light, {rider.first} unlocks the front and gives {rider.himself} up.', out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 24, minutes: 30 },
              { when: { notSafe: ['manager'] }, text: 'As it gets light, {rider.first} sends {manager.first} out and follows {manager.him}.', safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_by_dawn' }, objective: 45, minutes: 30 }],
            adverse: [{ when: { safe: ['manager'] }, text: 'When the shift changes, {rider.first} hasn’t moved from behind the counter.', next: { ending: 'rider_held' } },
              ...heldEnd({ when: MANAGER_IN, text: 'The shift changes with {manager.first} still on the floor beside {rider.first}.' }, '{clerk.first} hasn’t moved from the stockroom door either.', [], MANAGER_IN)],
          } },
      ] },
  ],
  endings: {
    out_on_camera: { title: 'Out on camera', disposition: 'resolved',
      summary: '{manager.first} and {clerk.first} are safe outside, and {manager.first} was out before {rider.first} was. {rider.first} walked out where everyone could see, and officers have {rider.him} now. The phone was still filming from the register when the last officer left.',
      epilogue: 'The clip of {rider.first} walking out had more views by morning than the stream ever did.',
      epilogueIf: [
        { when: { marks: ['admitted'] }, epilogue: '{rider.first}’s account was back on {delivery_app} by Friday. {rider.He} didn’t log in.' },
        { when: { marks: ['exposed'] }, epilogue: '{friend.first} drove {rider.first}’s scooter home and left the key with the neighbor, as {friend.he} said {friend.he} would.' },
      ] },
    out_quiet: { title: 'Nobody filmed it', disposition: 'resolved',
      summary: '{manager.first} and {clerk.first} are safe outside. {rider.first} walked out to the team with nobody filming, the one way {rider.he} said {rider.he} wouldn’t, and officers have {rider.him}. The phone is face down on the register with the stream still saying LIVE.',
      epilogue: '{friend.first} waited at the patrol line until the patrol car carrying {rider.first} turned the corner.',
      epilogueIf: [{ when: { marks: ['admitted'] }, epilogue: '{manager.first} called {delivery_app} on Monday and asked how to take a complaint back.' }] },
    out_by_dawn: { title: 'Out by morning', disposition: 'resolved',
      summary: '{manager.first} and {clerk.first} have been outside for hours, on the back step of the ambulance. {rider.first} came out after the long night and is in the team’s hands. {place} won’t open today.',
      epilogue: '{manager.first} asked twice in the night whether anyone had brought {rider.first} something to eat.' },
    entry_clean: { title: 'Out through an entry', disposition: 'resolved',
      summary: '{manager.first} and {clerk.first} are on the sidewalk, unhurt, and officers have {rider.first}, the handgun in an evidence bag. The phone on the register filmed the entry from start to finish, and somebody is still watching it.',
      epilogue: '{clerk.first} never went back to the night shift. {manager.first} didn’t ask {clerk.him} to.' },
    entry_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{manager.first} is getting care at the corner, hurt in the entry, one arm held tight against {manager.his} side. {clerk.first} is safe. Officers are holding {rider.first}, who keeps asking whether {manager.first} is all right.',
      epilogue: '{manager.first} hasn’t said {rider.first}’s name since, not to the officers and not to the nurse who asked.' },
    manager_killed: { title: '{manager.He} didn’t come out', disposition: 'relief_partial',
      summary: '{manager.first} died on the floor of {place}, by the cooler where {manager.he} sat all night. Officers hold {rider.first}, who isn’t hurt and hasn’t said a word since. {clerk.first} is in the back of a patrol car with {clerk.his} hands over {clerk.his} face.',
      epilogue: 'The whiteboard by the register still had the night’s pickup times on it, in green marker.' },
    manager_killed_rider_hurt: { title: 'Two carried out', disposition: 'relief_partial',
      summary: '{rider.first} is hurt, and the crew is working on {rider.him}. {manager.first} died before the team reached {manager.him}, behind the register where {manager.he} wrote the pickup times. {clerk.first} is safe in a patrol car and won’t let go of the door handle.',
      epilogue: 'In the ambulance {rider.first} asked whether the stream was still on. It was.' },
    manager_hurt_inside: { title: 'Struck in the dark', disposition: 'relief_partial', remainingTasks: ['Talk {rider.first} out from behind the counter'],
      summary: 'Medics have {manager.first}, hurt in the dark. {clerk.first} is safe. {rider.first} is still behind the counter with the handgun, and the street stays shut.',
      epilogue: '{manager.first} told the medic it was {manager.his} fault. The medic didn’t ask what was.' },
    rider_held: { title: 'Behind the counter', disposition: 'relief_partial', remainingTasks: ['Talk {rider.first} out of {place}'],
      summary: '{manager.first} and {clerk.first} are out of harm’s way. {rider.first} is holding out behind the counter with the handgun and the phone, and patrol keeps the street shut. The count on the stream is still going.',
      epilogue: '{friend.first} switched the scooter’s engine off and waited at the patrol line.' },
    held_counter: { title: 'Still on the floor', disposition: 'relief_partial', remainingTasks: ['Get {manager.first} out from behind the counter', 'Bring {rider.first} out alive'],
      summary: 'Command holds the street, with the team at the perimeter. {manager.first} is still on the floor inside with {rider.first} and the handgun, and the team calls the phone on the register every half hour.',
      epilogue: '{manager.first}’s green marker stayed on the counter all night with its cap off.' },
    held_both: { title: 'Both still inside', disposition: 'relief_partial',
      remainingTasks: ['Bring {clerk.first} out', 'Get {manager.first} out from behind the counter', 'Talk {rider.first} into putting the handgun down'],
      summary: 'Patrol has the block sealed. {clerk.first} and {manager.first} are both still in there with {rider.first}, who is armed, and the stream is still running.',
      epilogue: '{clerk.first} held the case of water until an officer finally took it from {clerk.him} at dawn.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get everyone out safely'],
      summary: 'Command still holds the street, and the call is still open. The team has no step left that it can take from here.',
      epilogue: '{manager.first} was still on the floor when the next shift called the store phone.' },
  },
  rewards: { funding: 2600, trust: 6, xp: 45 },
};
