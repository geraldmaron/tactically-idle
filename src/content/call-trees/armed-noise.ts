import type { CallTree, TreeChoice, TreeOutcome } from './types';

// After the Noise, as a call tree. After closing, a man with a handgun is trying to get through a
// locked door to a worker hiding with the cash box. Patrol heard the shots. Hidden truth: whether
// her door holds (door_holds) and whether he gives up once he knows the team is outside
// (gives_up). The door is a clock (content/incidents/armed.ts): when the frame is splitting it
// gives about twenty minutes in, and the worker says so a few minutes before. The weight: when the
// door won't hold, waiting can cost her life; when he would have walked out, rushing in risks
// officers and his life for nothing. Asking her about the door tells you which, and costs the
// minutes he spends at it.
//
// Self-harm screen (E4): screened. He wants the cash and a way out; no loss event, no goodbye.
// Deaths (E2.2): the worker can die when he gets through; he can die if he raises the handgun at
// close range. Each is one plain sentence, the person's state first, and the force goes to review.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const LISTEN = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
type Base = typeof TALK | typeof HOLD | typeof LISTEN | typeof MOVE | typeof ENTER;
const check = (base: Base, difficulty = 0): TreeChoice['check'] => ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });
const ENTRY = { requires: { certs: ['entry_team' as const] }, authority: 'entry' as const, equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }] };

/** The shooter goes back to the door: if it has run out of time by the end of this choice, the
 * shooter is through it. Holding now says nothing about how long it will last. */
// Both sides read the door at the same moment: a side's own `minutes` move where the fork looks, so
// the through side takes the holds side's minutes (the coverage gate found a band that matched
// neither side when the door gave between the two).
const doorFork = (through: string, holds: TreeOutcome, pressure = 12): TreeOutcome[] => [
  { if: { clock: 'door', out: true }, text: through, reveal: ['door_holds'], next: { node: 'through_door' }, pressure, ...(holds.minutes ? { minutes: holds.minutes } : {}) },
  { if: { clock: 'door', out: false }, ...holds },
];

export const ARMED_NOISE: CallTree = {
  type: 'active_armed_incident',
  title: 'After the Noise',
  roles: [
    { id: 'shooter', label: 'armed {shooter^man|woman|person}', pronouns: 'he', kind: 'subject', place: { rooms: ['retail', 'office'] }, carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'shots' } },
    { id: 'worker', label: 'closing shift', pronouns: 'she', kind: 'civilian' },
  ],
  // A counter, a cash drawer and a door to lock: shops, bars and a motel front desk. Offices and
  // warehouses have no drawer to rob, so the call is never drawn there.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2', 'motel_row_g2'],
  scene: { setting: 'business', rooms: ['office', 'storage'], timeOfDay: 'night' },
  summary: '{worker} locked {worker.himself} in the {scene} with the cash box. Someone with a handgun has been shooting at the lock.',
  pressureLabel: '{worker.first} behind one door',
  pressure: { start: 30, perMinute: 0.5, threshold: 80, civilianPerMinute: 0.8 },
  briefing: {
    dispatchReason: 'Patrol heard shots inside {place} after closing. {worker}, the closing shift, is locked in the {scene}, and the armed {shooter^man|woman|person} inside won’t answer patrol.',
    known: [
      '{worker.first} called 911 whispering. {worker.He} {worker~says|say} {shooter}, a regular, came in at closing for the cash, and {worker.he} ran for the {scene}.',
      'Patrol heard two shots from the street and a door being kicked.',
      'Patrol last saw {shooter.first} in the {shooter.room}, going through the cash drawer.',
    ],
    unknown: ['How long the {scene} door will hold'],
    responsibilities: ['Get {worker.first} out', 'Stop the shooting', 'Bring {shooter.first} out alive if {shooter.he} {shooter~lets|let} you'],
  },
  stageLabels: { assess: 'Shots after closing', adapt: 'One door', resolve: 'Who walks out' },
  objectives: [
    { id: 'worker', label: 'Get {worker.first} out' },
    { id: 'shooting', label: 'Stop the shooting' },
    { id: 'shooter', label: 'Bring {shooter.first} out alive' },
  ],
  facts: {
    shots: { public: true, truth: true, source: 'Responding patrol', label: 'Shots inside',
      claim: 'Patrol heard two shots inside {place} and a door being kicked.', confirmed: 'Patrol heard the shots and the kicking from the street.', disproved: 'Patrol could not confirm the shots.',
      // Reported from the first minute, so every entry in this call is authorized from the start.
      threat: '{shooter.first} fired at the lock on {worker.first}’s door' },
    door_holds: { label: 'The {scene} door', claim: 'Whether the {scene} door will hold.',
      confirmed: '{worker.first} says the bolt is still holding in the frame.', disproved: '{worker.first} says the frame is splitting around the bolt.' },
    gives_up: { label: 'Whether {shooter.first} gives up', claim: 'Whether {shooter.first} gives up once {shooter.he} {shooter~knows|know} the team is outside.',
      confirmed: '{shooter.first} wants out once {shooter.he} {shooter~knows|know} {shooter.he} {shooter~is|are} caught.', disproved: '{shooter.first} digs in once {shooter.he} {shooter~knows|know} the team is outside.' },
  },
  situations: [
    { note: 'The door holds, and {shooter.he} {shooter~wants|want} out once {shooter.he} {shooter~knows|know} {shooter.he} {shooter~is|are} caught.', truth: { door_holds: true, gives_up: true } },
    { note: 'The door holds, and {shooter.he} {shooter~digs|dig} in at the counter once {shooter.he} {shooter~knows|know}.', truth: { door_holds: true, gives_up: false } },
    { note: 'The frame is splitting, and {shooter.he} won’t stop. Every minute counts.', truth: { door_holds: false, gives_up: false } },
  ],
  turns: { inside: ['quiet_till', 'shelf_door'] },
  difficulty: { base: 34, perTier: 3 },
  root: 'shots',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'shots', stage: 'assess',
      prompt: '{worker.first} is whispering on the line from the {scene}. Patrol just heard a third shot, then kicking.',
      choices: [
        { id: 'go_now', title: 'Send the team in now', icon: 'shield', ...ENTRY, check: check(ENTER, 6), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          summary: 'The team moves before anyone knows how {worker.first}’s door is holding. The first officer through the doorway faces the handgun.',
          preview: { favorable: 'The team is inside and between {shooter.him} and {worker.first}.', mixed: 'The team gets between them, with a shot fired at the doorway.', adverse: '{shooter.He} {shooter~fires|fire} at the team in the doorway, and the team falls back. An officer may be hit.' },
          outcomes: {
            favorable: [{ text: 'The team is through the front before {shooter.he} {shooter~turns|turn} from the cash drawer. Two officers stand between {shooter.him} and the {scene} door.', next: { node: 'cornered' }, objective: 25 }],
            mixed: [{ text: 'The team gets between {shooter.him} and the {scene} door. One shot goes through the doorframe beside the lead officer’s head.', mark: ['shots_fired'], next: { node: 'cornered' }, objective: 18, pressure: 8 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} twice at the doorway, and the team falls back to the sidewalk.', fire: { from: 'shooter', mark: 'officer_down' }, mark: ['shots_fired'], next: { node: 'pinned' }, pressure: 14 }],
          } },
        { id: 'ask_door', title: 'Ask {worker.first} about the door', icon: 'search', talksTo: 'worker', check: check(LISTEN, -4), minutes: 3,
          summary: '{lead} asks {worker.first} what the door is doing. You will know how long you have, and {shooter.he} {shooter~spends|spend} those minutes at that door.',
          preview: { favorable: '{worker.first} tells you exactly how the door is holding.', mixed: '{worker.first} can only whisper a few words before {shooter.he} {shooter~is|are} back at the door.', adverse: '{shooter.He} {shooter~is|are} at the door while {worker.he} {worker~answers|answer}. If it gives, {worker.he} {worker~is|are} in there alone with {shooter.him}.' },
          outcomes: {
            favorable: [
              { if: { fact: 'door_holds', is: true }, text: '{worker.first} says the bolt is steel and still tight in the frame. {shooter.He} {shooter~has|have} gone back to the cash drawer.', reveal: ['door_holds'], mark: ['door_strong'], next: { turn: 'inside' }, objective: 10 },
              { if: { fact: 'door_holds', is: false }, text: '{worker.first} says the frame is splitting around the bolt. {worker.He} {worker~is|are} holding it shut with {worker.him} back.', reveal: ['door_holds'], mark: ['door_weak'], next: { turn: 'inside' }, objective: 10 },
            ],
            mixed: [
              { if: { fact: 'door_holds', is: true }, text: '{worker.first} whispers that the bolt is holding, then goes quiet as {shooter.he} {shooter~kicks|kick} it again.', reveal: ['door_holds'], mark: ['door_strong'], next: { turn: 'inside' }, pressure: 6 },
              { if: { fact: 'door_holds', is: false }, text: '{worker.first} whispers that the wood is cracking, then the line fills with kicking.', reveal: ['door_holds'], mark: ['door_weak'], next: { turn: 'inside' }, pressure: 8 },
            ],
            adverse: doorFork('The frame gives while {worker.he} {worker~is|are} answering. {worker.first} screams, and the line goes dead.',
              { text: '{worker.first} drops the phone when {shooter.he} {shooter~kicks|kick} the door. It holds. {worker.He} {worker~picks|pick} the phone back up shaking.', next: { turn: 'inside' }, pressure: 6 }),
          } },
        { id: 'announce', title: 'Announce the team on the loud hailer', icon: 'radio', check: check(TALK), minutes: 2,
          requires: { anyTags: ['hailer'] },
          summary: '{shooter.He} {shooter~learns|learn} the building is surrounded. Someone who wants out walks out, and someone who doesn’t goes back to the one door {shooter.he} can reach.',
          preview: { favorable: '{shooter.He} {shooter~answers|answer} the hailer and {shooter~knows|know} {shooter.he} {shooter~is|are} caught.', mixed: '{shooter.He} {shooter~shouts|shout} back at the hailer before {shooter.he} {shooter~decides|decide} anything.', adverse: '{shooter.He} {shooter~goes|go} back to {worker.his} door harder, and it may not hold.' },
          outcomes: {
            favorable: [
              { if: { fact: 'gives_up', is: true }, text: 'The kicking stops. {shooter.He} {shooter~shouts|shout} that {shooter.he} {shooter~is|are} not trying to hurt anybody and {shooter~asks|ask} how {shooter.he} {shooter~comes|come} out.', reveal: ['gives_up'], next: { node: 'coming_out' }, objective: 20, pressure: -8 },
              { if: { fact: 'gives_up', is: false }, text: '{shooter.He} {shooter~shouts|shout} that anyone who comes in gets shot, and {shooter~goes|go} quiet near the {scene} door.', reveal: ['gives_up'], next: { node: 'dug_in' }, objective: 8 },
            ],
            mixed: [
              { if: { fact: 'gives_up', is: true }, text: '{shooter.He} {shooter~swears|swear} at the hailer for a full minute. Then {shooter.he} {shooter~asks|ask} who {shooter.he} {shooter~talks|talk} to.', reveal: ['gives_up'], next: { node: 'coming_out' }, objective: 14 },
              { if: { fact: 'gives_up', is: false }, text: '{shooter.He} {shooter~shouts|shout} back that nobody is taking the cash off {shooter.him}, then {shooter~starts|start} on the door again.', reveal: ['gives_up'], next: { node: 'dug_in' }, pressure: 8 },
            ],
            adverse: doorFork('{shooter.He} {shooter~goes|go} back at the door with everything {shooter.he} {shooter~has|have}. The frame gives, and the line from {worker.first} goes dead.',
              { text: '{shooter.He} {shooter~goes|go} back to the door and {shooter~kicks|kick} it until {shooter.he} {shooter~is|are} out of breath. It holds.', next: { node: 'dug_in' }, pressure: 8 }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2
    { id: 'quiet_till', stage: 'adapt',
      prompt: 'The kicking has stopped. {worker.first} can hear the cash drawer in the {shooter.room}, opening and slamming.',
      promptIf: [
        { when: { marks: ['door_weak'] }, prompt: '{shooter.He} {shooter~has|have} left the door for the cash drawer. {worker.first} is holding the split frame shut with {worker.him} back.' },
        { when: { marks: ['door_strong'] }, prompt: 'The bolt is holding, and {shooter.he} {shooter~has|have} gone back to the cash drawer. {worker.first} can hear the drawer slamming.' },
      ],
      choices: [
        { id: 'while_busy', title: 'Go in while {shooter.he} {shooter~is|are} at the drawer', icon: 'shield', ...ENTRY, check: check(ENTER, 2), minutes: 2, stress: 5, tempo: 'urgent', consequenceLevel: 'severe',
          summary: 'The team slips in to cut {shooter.him} off from {worker.first}’s door. If {shooter.he} {shooter~looks|look} up first, an officer can be hit across the counter.',
          preview: { favorable: 'The team is between {shooter.him} and {worker.him} before {shooter.he} {shooter~looks|look} up.', mixed: 'The team gets between them, and {shooter.he} {shooter~fires|fire} once from behind the counter.', adverse: '{shooter.He} {shooter~looks|look} up first and {shooter~fires|fire} at the doorway, and an officer may be hit.' },
          outcomes: {
            favorable: [{ text: 'The team is between the counter and the {scene} door before {shooter.he} {shooter~looks|look} up from the drawer.', next: { node: 'cornered' }, objective: 25 }],
            mixed: [{ text: 'The team gets between them. {shooter.He} {shooter~fires|fire} once from behind the counter and {shooter~hits|hit} the frame by an officer’s head.', mark: ['shots_fired'], next: { node: 'cornered' }, objective: 18, pressure: 8 }],
            adverse: [{ text: '{shooter.He} {shooter~looks|look} up first and {shooter~fires|fire}, and the team pulls back out the front.', fire: { from: 'shooter', mark: 'officer_down' }, mark: ['shots_fired'], next: { node: 'pinned' }, pressure: 14 }],
          } },
        { id: 'slip_out', title: 'Walk {worker.first} out behind {shooter.his} back', icon: 'door', walks: 'worker', check: check(MOVE, 4), minutes: 3, consequenceLevel: 'high',
          modifiers: [{ label: 'You know the door is splitting', mark: 'door_weak', value: -4 }],
          summary: '{lead} talks {worker.first} through opening {worker.his} door and walking out while the drawer is still slamming. If {shooter.first} hears the bolt, {worker.he} {worker~is|are} in the open with {shooter.him}.',
          preview: { favorable: '{worker.first} walks out while {shooter.he} {shooter~is|are} busy at the drawer.', mixed: '{worker.first} gets out, and {shooter.he} {shooter~hears|hear} {worker.him} go.', adverse: '{shooter.He} {shooter~hears|hear} the bolt and {shooter~catches|catch} {worker.him} between the door and the exit.' },
          outcomes: {
            favorable: [{ text: '{worker.first} opens the door an inch at a time and walks out while the drawer is still slamming. Patrol has {worker.him}.', safe: ['worker'], next: { node: 'last_man' }, objective: 40 }],
            mixed: [{ text: '{worker.first} gets out. {shooter.first} hears the bolt and shouts after {worker.him}, then fires once into the wall.', safe: ['worker'], mark: ['shots_fired'], next: { node: 'last_man' }, objective: 34, pressure: 8 }],
            adverse: [{ text: '{shooter.He} {shooter~hears|hear} the bolt. {shooter.He} {shooter~catches|catch} {worker.first} halfway out and {shooter~pulls|pull} {worker.him} back toward the {scene}, the handgun at {worker.his} side.', next: { node: 'through_door' }, pressure: 14 }],
          } },
        { id: 'let_him_take', title: 'Let {shooter.him} take the cash and leave', icon: 'wait', check: check(HOLD, -6), minutes: 6,
          summary: 'Nobody moves while {shooter.he} {shooter~empties|empty} the drawer. If {shooter.he} {shooter~walks|walk} out with it, patrol takes {shooter.him} on the street, away from {worker.him}. If {shooter.he} {shooter~goes|go} back for the box, everything rests on {worker.his} door.',
          preview: { favorable: '{shooter.He} {shooter~empties|empty} the drawer and {shooter~chooses|choose} between the front door and {worker.hers}.', mixed: '{shooter.He} {shooter~takes|take} the cash and {shooter~goes|go} back to {worker.his} door for the box.', adverse: '{shooter.He} {shooter~takes|take} the cash and {shooter~goes|go} back for {worker.him}, and the door may not hold.' },
          outcomes: {
            favorable: [
              { if: { clock: 'door', out: true }, text: '{shooter.He} {shooter~stuffs|stuff} the cash in {shooter.his} jacket, then {shooter~goes|go} back for the box. The split frame gives on {shooter.his} second kick.', reveal: ['door_holds'], next: { node: 'through_door' }, pressure: 12 },
              { if: [{ clock: 'door', out: false }, { fact: 'gives_up', is: true }], text: '{shooter.He} {shooter~stuffs|stuff} the cash in {shooter.his} jacket and {shooter~walks|walk} out the front, straight into patrol’s lights. {shooter.He} {shooter~stops|stop} on the step.', reveal: ['gives_up'], next: { node: 'coming_out' }, objective: 20 },
              { if: [{ clock: 'door', out: false }, { fact: 'gives_up', is: false }], text: '{shooter.He} {shooter~stuffs|stuff} the cash in {shooter.his} jacket, {shooter~sees|see} patrol’s lights through the glass and {shooter~goes|go} back to the {scene} door. It holds.', reveal: ['gives_up'], next: { node: 'dug_in' }, pressure: 6 },
            ],
            mixed: doorFork('{shooter.He} {shooter~takes|take} the cash and {shooter~goes|go} back to {worker.his} door for the box. The split frame gives.',
              { text: '{shooter.He} {shooter~takes|take} the cash and {shooter~goes|go} back to {worker.his} door, saying {shooter.he} {shooter~needs|need} the box too. The bolt holds.', next: { node: 'dug_in' }, pressure: 8 }),
            adverse: doorFork('{shooter.He} {shooter~goes|go} back to {worker.his} door with the cash in {shooter.his} jacket and {shooter~puts|put} {shooter.his} shoulder into it. The frame gives.',
              { text: '{shooter.He} {shooter~goes|go} back to {worker.his} door with the cash in {shooter.his} jacket and {shooter~kicks|kick} it until it splinters. The bolt holds.', next: { node: 'dug_in' }, pressure: 10 }),
          } },
      ] },
    { id: 'shelf_door', stage: 'adapt',
      prompt: '{shooter.He} {shooter~has|have} dragged a shelf across the {scene} door. {worker.first} can’t get out that way, and the team can’t get in.',
      choices: [
        { id: 'draw_front', title: 'Draw {shooter.him} to the front, then go for {worker.him}', icon: 'shield', ...ENTRY, check: check(ENTER, 4), minutes: 5, stress: 5, consequenceLevel: 'severe',
          summary: 'One officer bangs on the front glass while {lead} takes the team to the shelf. If {shooter.he} {shooter~ignores|ignore} the noise, {shooter.he} {shooter~is|are} between the team and {worker.his} door.',
          preview: { favorable: '{shooter.He} {shooter~goes|go} to the front, and the team gets {worker.him} out.', mixed: 'The team gets {worker.him} out, and {shooter.he} {shooter~comes|come} back firing.', adverse: '{shooter.He} {shooter~doesn’t|don’t} take the bait and {shooter~fires|fire} at the shelf. An officer may be hit.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~goes|go} to the front to shout at the glass. The team drags the shelf aside and brings {worker.first} out shaking but walking.', safe: ['worker'], next: { node: 'last_man' }, objective: 40 }],
            mixed: [{ text: 'The team gets {worker.first} out as {shooter.he} {shooter~comes|come} back. {shooter.He} {shooter~fires|fire} twice at the corridor and {shooter~misses|miss}.', safe: ['worker'], mark: ['shots_fired'], next: { node: 'last_man' }, objective: 32, pressure: 8 }],
            adverse: [{ text: '{shooter.He} {shooter~doesn’t|don’t} go to the front. {shooter.He} {shooter~fires|fire} at the team at the shelf, and the team pulls back.', fire: { from: 'shooter', mark: 'officer_down' }, mark: ['shots_fired'], next: { node: 'pinned' }, pressure: 14 }],
          } },
        { id: 'through_glass', title: 'Talk to {shooter.him} through the front glass', icon: 'radio', talksTo: 'shooter', check: check(TALK, 2), minutes: 3, stress: 3,
          summary: '{lead} calls to {shooter.him} through the front glass, close enough to be heard over the alarm. Close enough to be seen, too.',
          preview: { favorable: '{shooter.He} {shooter~answers|answer}, and {shooter~leaves|leave} the shelf where it is.', mixed: '{shooter.He} {shooter~answers|answer} with the handgun pointed at the glass.', adverse: '{shooter.He} {shooter~fires|fire} at the glass.' },
          outcomes: {
            favorable: [
              { if: { fact: 'gives_up', is: true }, text: '{shooter.He} {shooter~answers|answer}. {shooter.He} {shooter~says|say} {shooter.he} didn’t mean for anyone to be here, and {shooter~asks|ask} what happens now.', reveal: ['gives_up'], next: { node: 'coming_out' }, objective: 20 },
              { if: { fact: 'gives_up', is: false }, text: '{shooter.He} {shooter~answers|answer} that the shelf stays where it is until {shooter.he} {shooter~has|have} a car. {shooter.He} {shooter~doesn’t|don’t} go near it.', reveal: ['gives_up'], next: { node: 'dug_in' }, objective: 10 },
            ],
            mixed: [{ text: '{shooter.He} {shooter~answers|answer} with the handgun pointed at the glass and {shooter~tells|tell} the officer to back off.', next: { node: 'dug_in' }, pressure: 6 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} at the glass. It cracks a foot from the officer, who drops behind the patrol car.', mark: ['shots_fired'], next: { node: 'dug_in' }, pressure: 12 }],
          } },
        { id: 'shelf_wait', title: 'Hold the perimeter and wait', icon: 'wait', check: check(HOLD, -8), minutes: 10,
          summary: 'You keep everyone back and let {shooter.him} decide what the shelf is for. {worker.first} stays on the line, and the shelf stays where it is unless {shooter.he} {shooter~moves|move} it.',
          preview: { favorable: '{shooter.He} {shooter~sits|sit} down behind the counter, if {worker.his} door is still holding.', mixed: '{shooter.He} {shooter~paces|pace} between the counter and {worker.his} door, and the door may not hold.', adverse: '{shooter.He} {shooter~moves|move} the shelf, and the door may not hold.' },
          outcomes: {
            favorable: doorFork('Ten minutes in, {shooter.he} {shooter~pulls|pull} the shelf aside and {shooter~leans|lean} on {worker.his} door. The split frame gives.',
              { text: 'After ten minutes {shooter.he} {shooter~sits|sit} down on the floor behind the counter. {worker.first} whispers that it has gone quiet.', next: { node: 'dug_in' }, objective: 8, pressure: -4 }),
            mixed: doorFork('{shooter.He} {shooter~paces|pace} between the counter and {worker.his} door, then {shooter~pulls|pull} the shelf away. The split frame gives.',
              { text: '{shooter.He} {shooter~paces|pace} between the counter and {worker.his} door, talking to {shooter.himself}. The shelf stays where it is.', next: { node: 'dug_in' }, pressure: 6 }),
            adverse: doorFork('{shooter.He} {shooter~drags|drag} the shelf away and {shooter~goes|go} at {worker.his} door. The frame gives.',
              { text: '{shooter.He} {shooter~drags|drag} the shelf away and {shooter~throws|throw} {shooter.his} weight at {worker.his} door until {shooter.he} {shooter~has|have} to stop. It holds.', next: { node: 'dug_in' }, pressure: 10 }),
          } },
      ] },
    { id: 'dug_in', stage: 'adapt',
      prompt: '{shooter.He} {shooter~knows|know} the team is outside, and {shooter.he} still {shooter~has|have} the handgun. {worker.first} is behind {worker.his} door, listening to {shooter.him}.',
      promptIf: [{ when: { marks: ['door_weak'] }, prompt: '{shooter.He} {shooter~knows|know} the team is outside. {worker.first} says the frame cracks a little more each time {shooter.he} {shooter~hits|hit} it.' }],
      choices: [
        { id: 'talk_him_down', title: 'Get {shooter.him} on the phone and keep {shooter.him} there', icon: 'radio', talksTo: 'shooter', check: check(TALK), minutes: 6,
          summary: '{lead} calls the counter phone and keeps {shooter.him} on it, away from {worker.his} door. If {shooter.he} won’t pick up, the time goes by anyway.',
          preview: { favorable: '{shooter.He} {shooter~picks|pick} up and {shooter~stays|stay} on the phone.', mixed: '{shooter.He} {shooter~picks|pick} up, then {shooter~goes|go} back to {worker.his} door between calls.', adverse: '{shooter.He} won’t pick up and {shooter~goes|go} back to {worker.his} door, and it may not hold.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~picks|pick} up the counter phone on the third call and {shooter~stays|stay} on it, sitting on the counter.', mark: ['talking'], moves: { shooter: 'contact' }, next: { node: 'standoff' }, objective: 14, pressure: -6 }],
            mixed: [{ text: '{shooter.He} {shooter~picks|pick} up, {shooter~shouts|shout}, {shooter~hangs|hang} up and {shooter~goes|go} back to {worker.his} door, then {shooter~picks|pick} up again.', mark: ['talking'], moves: { shooter: 'contact' }, next: { node: 'standoff' }, pressure: 4 }],
            adverse: doorFork('{shooter.He} won’t pick up. {shooter.He} {shooter~goes|go} back to {worker.his} door, and this time the frame gives.',
              { text: '{shooter.He} won’t pick up. {shooter.He} {shooter~kicks|kick} {worker.his} door twice more and {shooter~sits|sit} down against it.', next: { node: 'standoff' }, pressure: 8 }),
          } },
        { id: 'go_in_dug', title: 'Send the team in for {worker.him}', icon: 'shield', ...ENTRY, check: check(ENTER, 8), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          modifiers: [{ label: 'You know the door is splitting', mark: 'door_weak', value: 4 }],
          summary: 'The team goes past the counter to reach {worker.his} door. {shooter.first} is armed and waiting for them.',
          preview: { favorable: 'The team reaches {worker.his} door before {shooter.he} {shooter~does|do}.', mixed: 'The team reaches {worker.him}, with a shot fired over the shield.', adverse: '{shooter.He} {shooter~fires|fire} first, and an officer may be hit between {shooter.him} and {worker.his} door.' },
          outcomes: {
            favorable: [{ text: 'The team is in and between {shooter.him} and {worker.his} door before {shooter.he} {shooter~gets|get} up from behind the counter.', next: { node: 'cornered' }, objective: 25 }],
            mixed: [{ text: 'The team gets between {shooter.him} and {worker.his} door. {shooter.He} {shooter~fires|fire} once, and the round goes into the ceiling over the shield.', mark: ['shots_fired'], next: { node: 'cornered' }, objective: 18, pressure: 8 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} first, and the team pulls back out the front.', fire: { from: 'shooter', mark: 'officer_down' }, mark: ['shots_fired'], next: { node: 'pinned' }, pressure: 14 }],
          } },
        { id: 'dug_wait', title: 'Wait {shooter.him} out', icon: 'wait', check: check(HOLD, -10), minutes: 20,
          summary: 'You hold the perimeter and let {shooter.him} run out of things to do. Twenty minutes is a long time for a door, and {worker.first} spends them listening to {shooter.him} through it.',
          preview: { favorable: '{shooter.He} {shooter~sits|sit} down and {shooter~stays|stay} down, if the door holds that long.', mixed: '{shooter.He} {shooter~goes|go} at {worker.his} door until {shooter.he} {shooter~wears|wear} out, or until it gives.', adverse: '{shooter.He} {shooter~goes|go} at {worker.his} door again, and it may not hold.' },
          outcomes: {
            favorable: doorFork('Twenty minutes in, {shooter.he} {shooter~goes|go} back to {worker.his} door once more. The split frame gives.',
              { text: 'Twenty minutes in, {shooter.he} {shooter~sits|sit} down behind the counter and {shooter~picks|pick} up when the team calls.', mark: ['talking'], moves: { shooter: 'contact' }, next: { node: 'standoff' }, objective: 10, pressure: -6 }),
            mixed: doorFork('{shooter.He} {shooter~goes|go} at {worker.his} door three more times. On the third, the frame gives.',
              { text: '{shooter.He} {shooter~goes|go} at {worker.his} door three more times and {shooter~wears|wear} {shooter.himself} out. {worker.first} is crying on the line.', next: { node: 'standoff' }, pressure: 6 }),
            adverse: doorFork('{shooter.He} {shooter~goes|go} at {worker.his} door with a fire extinguisher. The frame gives on the third hit.',
              { text: '{shooter.He} {shooter~goes|go} at {worker.his} door with a fire extinguisher until {shooter.his} arms give out. The bolt holds.', next: { node: 'standoff' }, pressure: 10 }),
          } },
      ] },
    { id: 'pinned', stage: 'adapt',
      prompt: 'The team is back outside behind the patrol car. {worker.first} is still in the {scene}.',
      promptIf: [{ when: { marks: ['officer_down'] }, prompt: 'The team is back outside with an officer down behind the patrol car. {worker.first} is still in the {scene}.' }],
      choices: [
        { id: 'back_in', title: 'Go back in for {worker.him}', icon: 'shield', ...ENTRY, check: check(ENTER, 12), minutes: 2, stress: 7, tempo: 'urgent', consequenceLevel: 'severe',
          summary: 'The team regroups for a second entry, and {shooter.he} {shooter~is|are} watching the front door now.',
          preview: { favorable: 'The second entry gets between {shooter.him} and {worker.him}.', mixed: 'The team gets between them under fire, and an officer may be hit.', adverse: '{shooter.He} {shooter~fires|fire} at the door again, and the team can’t get in. Behind {shooter.him}, {worker.his} door may give.' },
          outcomes: {
            favorable: [{ text: 'The team goes in another way this time. {shooter.He} {shooter~is|are} still facing the front when they reach {worker.his} door.', next: { node: 'cornered' }, objective: 22 }],
            mixed: [{ text: 'The team gets between them as {shooter.he} {shooter~fires|fire} at the door.', fire: { from: 'shooter' }, next: { node: 'cornered' }, objective: 15, pressure: 10 }],
            adverse: doorFork('{shooter.He} {shooter~fires|fire} at the door again, and the team can’t get in. Behind {shooter.him}, the {scene} door gives.',
              { text: '{shooter.He} {shooter~fires|fire} at the door again, and the team pulls back a second time. {worker.His} door is still shut.', next: { ending: 'held_inside' }, pressure: 12 }),
          } },
        { id: 'pinned_talk', title: 'Call {shooter.him} on the hailer from cover', icon: 'radio', talksTo: 'shooter', check: check(TALK, 2), minutes: 5,
          summary: '{lead} talks from behind the patrol car. {shooter.He} {shooter~has|have} just fired at the team, and {shooter.he} {shooter~knows|know} it.',
          preview: { favorable: '{shooter.He} {shooter~answers|answer} and {shooter~asks|ask} if anyone is hurt.', mixed: '{shooter.He} {shooter~answers|answer} and {shooter~shouts|shout} that it was the team’s fault.', adverse: '{shooter.He} won’t answer and {shooter~goes|go} back to {worker.his} door. It may not hold.' },
          outcomes: {
            favorable: [
              { if: { fact: 'gives_up', is: true }, text: '{shooter.He} {shooter~answers|answer}. {shooter.He} {shooter~asks|ask} whether anyone is hurt, and {shooter~says|say} {shooter.he} {shooter~wants|want} to come out.', reveal: ['gives_up'], next: { node: 'coming_out' }, objective: 18 },
              { if: { fact: 'gives_up', is: false }, text: '{shooter.He} {shooter~answers|answer}. {shooter.He} {shooter~asks|ask} whether anyone is hurt, then {shooter~says|say} nobody comes in.', reveal: ['gives_up'], mark: ['talking'], moves: { shooter: 'contact' }, next: { node: 'standoff' }, objective: 10 },
            ],
            mixed: [{ text: '{shooter.He} {shooter~shouts|shout} that the team came at {shooter.him} first, and {shooter~keeps|keep} shouting.', next: { node: 'standoff' }, pressure: 6 }],
            adverse: doorFork('{shooter.He} won’t answer. Through the glass, the team sees {shooter.him} go back to {worker.his} door, and it gives.',
              { text: '{shooter.He} won’t answer. {shooter.He} {shooter~goes|go} back to {worker.his} door and {shooter~hammers|hammer} the bolt with the handgun until it bends. It holds.', next: { node: 'standoff' }, pressure: 8 }),
          } },
        { id: 'treat_ours', title: 'Get the officer to the medic first', icon: 'wait', check: check(HOLD, -6), minutes: 10, onlyIf: { marks: ['officer_down'] },
          summary: 'Everyone holds the perimeter while the officer who went down is carried to the ambulance. {worker.first} stays on the line, and nobody goes back in for ten minutes.',
          preview: { favorable: 'The officer is with the medic. If {worker.his} door is splitting, ten minutes is enough for {shooter.him} to get through it.', mixed: 'The officer is with the medic, and {shooter.he} {shooter~goes|go} back to {worker.his} door. It may not hold.', adverse: '{shooter.He} {shooter~spends|spend} the ten minutes on {worker.his} door, and it may not hold.' },
          outcomes: {
            favorable: doorFork('The officer reaches the ambulance. Inside, {shooter.he} {shooter~goes|go} back to {worker.his} door, and the frame gives.',
              { text: 'The officer reaches the ambulance. {shooter.He} {shooter~stays|stay} behind the counter, shouting that {shooter.he} didn’t mean it.', next: { node: 'standoff' }, objective: 8 }),
            mixed: doorFork('The officer reaches the ambulance. Inside, the {scene} door gives.',
              { text: 'The officer reaches the ambulance. Inside, {shooter.he} {shooter~puts|put} {shooter.his} shoulder into {worker.his} door until the frame groans. It holds.', next: { node: 'standoff' }, pressure: 6 }),
            adverse: doorFork('While the team carries the officer out, {shooter.he} {shooter~goes|go} at {worker.his} door with everything {shooter.he} {shooter~has|have}. The frame gives.',
              { text: 'While the team carries the officer out, {shooter.he} {shooter~goes|go} at {worker.his} door with an extinguisher. It holds, barely.', next: { node: 'standoff' }, pressure: 10 }),
          } },
        { id: 'regroup', title: 'Hold at the cars and regroup', icon: 'wait', check: check(HOLD, -6), minutes: 10, onlyIf: { notMarks: ['officer_down'] },
          summary: 'Nobody was hit, and everyone holds the perimeter for ten minutes before anyone goes near the door again. {worker.first} stays on the line.',
          preview: { favorable: 'The team is set again. If {worker.his} door is splitting, ten minutes is enough for {shooter.him} to get through it.', mixed: 'The team regroups, and {shooter.he} {shooter~goes|go} back to {worker.his} door. It may not hold.', adverse: '{shooter.He} {shooter~spends|spend} the ten minutes on {worker.his} door, and it may not hold.' },
          outcomes: {
            favorable: doorFork('The team regroups behind the cars. Inside, {shooter.he} {shooter~goes|go} back to {worker.his} door, and the frame gives.',
              { text: 'The team regroups behind the cars. {shooter.He} {shooter~stays|stay} behind the counter, shouting that nobody had better try that again.', next: { node: 'standoff' }, objective: 8 }),
            mixed: doorFork('The team regroups behind the cars. Inside, the {scene} door gives.',
              { text: 'The team regroups. Inside, {shooter.he} {shooter~kicks|kick} {worker.his} door until the hinges creak. It holds.', next: { node: 'standoff' }, pressure: 6 }),
            adverse: doorFork('While the team regroups, {shooter.he} {shooter~goes|go} at {worker.his} door with everything {shooter.he} {shooter~has|have}. The frame gives.',
              { text: 'While the team regroups, {shooter.he} {shooter~goes|go} at {worker.his} door with a chair. It holds, barely.', next: { node: 'standoff' }, pressure: 10 }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'cornered', stage: 'resolve',
      prompt: 'The team is between {shooter.him} and the {scene}. {shooter.He} {shooter~is|are} behind the counter with the handgun, and {shooter.he} {shooter~hasn’t|haven’t} fired at the team.',
      promptIf: [{ when: { marks: ['shots_fired'] }, prompt: 'The team is between {shooter.him} and the {scene}. {shooter.He} {shooter~has|have} already fired, and {shooter.he} {shooter~is|are} behind the counter with the handgun.' }],
      choices: [
        { id: 'put_it_down', title: 'Tell {shooter.him} to put the handgun down', icon: 'radio', talksTo: 'shooter', check: check(TALK, 2), minutes: 3, stress: 5, consequenceLevel: 'severe',
          modifiers: [{ label: '{shooter.He} {shooter~has|have} already fired at the team', mark: 'shots_fired', value: -8 }],
          summary: '{lead} tells {shooter.him} what to do, slowly, ten feet away. Everyone in the room is watching {shooter.his} hands.',
          preview: { favorable: '{shooter.He} {shooter~puts|put} the handgun on the counter.', mixed: '{shooter.He} {shooter~puts|put} the handgun down after a long minute.', adverse: '{shooter.He} {shooter~brings|bring} the handgun up. The team fires, and {shooter.he} may die.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~puts|put} the handgun on the counter and {shooter~steps|step} back with {shooter.his} hands open. The team has {shooter.him}, and {worker.first} comes out of the {scene}.', safe: ['worker'], out: ['shooter'], next: { ending: 'everyone_out' }, objective: 50 }],
            mixed: [{ text: '{shooter.He} {shooter~holds|hold} the handgun at {shooter.his} side for a long minute. Then {shooter.he} {shooter~lets|let} it fall. The team has {shooter.him}, and {worker.first} comes out walking.', safe: ['worker'], out: ['shooter'], next: { ending: 'everyone_out' }, objective: 44, pressure: 4 }],
            adverse: [
              { if: { fact: 'gives_up', is: false }, text: '{shooter.He} {shooter~brings|bring} the handgun up as {worker.first} comes out of the {scene}.', reveal: ['gives_up'], safe: ['worker'], force: { on: 'shooter', next: { fatal: { ending: 'subject_killed' }, hurt: { ending: 'subject_shot' }, none: { ending: 'taken' } } }, objective: 20 },
              { if: { fact: 'gives_up', is: true }, text: '{shooter.He} {shooter~turns|turn} too fast with the handgun still in {shooter.his} hand as {worker.first} comes out.', reveal: ['gives_up'], safe: ['worker'], force: { on: 'shooter', next: { fatal: { ending: 'subject_killed' }, hurt: { ending: 'subject_shot' }, none: { ending: 'taken' } } }, objective: 24 },
            ],
          } },
        { id: 'take_him', title: 'Take {shooter.him} before {shooter.he} {shooter~decides|decide}', icon: 'shield', check: check(ENTER, 6), minutes: 1, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry',
          summary: 'The handgun is still in {shooter.his} hand when the team reaches {shooter.him}. The team closes the ten feet before {shooter.he} can think about it.',
          preview: { favorable: 'The team has {shooter.him} and the handgun before {shooter.he} {shooter~moves|move}.', mixed: 'The team has {shooter.him}, and an officer is hurt in the struggle.', adverse: '{shooter.He} {shooter~gets|get} the handgun up in the struggle, and the team fires.' },
          outcomes: {
            favorable: [{ text: 'The team has {shooter.his} arms before {shooter.he} {shooter~moves|move}. The handgun is on the floor, and {worker.first} comes out of the {scene}.', safe: ['worker'], out: ['shooter'], next: { ending: 'taken' }, objective: 46 }],
            mixed: [{ text: 'The team takes {shooter.him} to the floor. An officer’s wrist breaks in the struggle. {worker.first} comes out walking.', officer: 'wounded', safe: ['worker'], out: ['shooter'], next: { ending: 'taken' }, objective: 38 }],
            adverse: [{ text: '{shooter.He} {shooter~gets|get} the handgun up in the struggle as {worker.first} gets out.', safe: ['worker'], force: { on: 'shooter', next: { fatal: { ending: 'subject_killed' }, hurt: { ending: 'subject_shot' }, none: { ending: 'taken' } } }, objective: 22 }],
          } },
        { id: 'her_first', title: 'Get {worker.first} out first', icon: 'door', walks: 'worker', check: check(MOVE), minutes: 3, consequenceLevel: 'high',
          summary: 'Two officers walk {worker.first} out behind a shield while the rest hold {shooter.first} at the counter. {worker.He} {worker~walks|walk} out while {shooter.he} {shooter~is|are} still holding the handgun.',
          preview: { favorable: '{worker.first} is out, and {shooter.he} {shooter~is|are} alone inside.', mixed: '{worker.first} gets out, and {shooter.he} {shooter~follows|follow} {worker.him} with the handgun.', adverse: '{shooter.He} {shooter~fires|fire} as {worker.he} {worker~goes|go}, and {worker.he} {worker~is|are} hit.' },
          outcomes: {
            favorable: [{ text: '{worker.first} walks out behind the shield without looking at {shooter.him}. The team backs out after {worker.him} and leaves {shooter.him} alone at the counter.', safe: ['worker'], next: { node: 'last_man' }, objective: 38 }],
            mixed: [{ text: '{worker.first} gets out. {shooter.He} {shooter~tracks|track} {worker.him} across the room with the handgun and doesn’t fire, and the team backs out after {worker.him}.', safe: ['worker'], next: { node: 'last_man' }, objective: 32, pressure: 6 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} as {worker.he} {worker~goes|go}. The shield takes one round and {worker.first} takes the other in the arm. The team has {shooter.him} on the floor before {shooter.he} {shooter~fires|fire} again, and the medic has {worker.him} outside.', safe: ['worker'], harm: { worker: 'serious' }, out: ['shooter'], next: { ending: 'worker_hurt' }, objective: 18 }],
          } },
      ] },
    { id: 'through_door', stage: 'resolve',
      prompt: '{shooter.He} {shooter~is|are} through the {scene} door. {worker.first} is in there with {shooter.him} and the handgun.',
      choices: [
        { id: 'go_in_now', title: 'Go in now', icon: 'shield', ...ENTRY, check: check(ENTER, 6), minutes: 1, stress: 7, tempo: 'urgent', consequenceLevel: 'severe',
          summary: '{worker.first} can die before the team gets there. The team goes straight to the {scene}, with no plan left but speed.',
          preview: { favorable: 'The team reaches {worker.him} before {shooter.he} {shooter~fires|fire}.', mixed: 'The team reaches {worker.him}, and {worker.he} {worker~is|are} hurt.', adverse: 'The team doesn’t reach {worker.him} in time, and {worker.first} is killed.' },
          outcomes: {
            favorable: [{ text: 'The team is in the {scene} doorway before {shooter.he} {shooter~turns|turn} around. {shooter.He} {shooter~drops|drop} the handgun. {worker.first} walks out between two officers.', safe: ['worker'], out: ['shooter'], next: { ending: 'taken' }, objective: 46 }],
            mixed: [{ text: 'The team reaches the {scene} as {shooter.he} {shooter~fires|fire}. {worker.first} is hit in the side. The medic has {worker.him}, and the team has {shooter.him}.', safe: ['worker'], harm: { worker: 'serious' }, out: ['shooter'], next: { ending: 'worker_hurt' }, objective: 20 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} before the team reaches the {scene}. {worker.first} dies on the floor by the cash box. The team has {shooter.him}.', harm: { worker: 'fatal' }, out: ['shooter'], next: { ending: 'worker_killed' }, objective: 5 }],
          } },
        { id: 'anyone_in', title: 'Send in whoever can go', icon: 'shield', check: check(ENTER, 14), minutes: 1, stress: 8, tempo: 'urgent', consequenceLevel: 'severe', authority: 'entry',
          summary: 'Every officer still standing goes for the {scene}, trained for it or not. It is the fastest way to {worker.him}, and the least prepared one.',
          preview: { favorable: 'The officers reach {worker.him} before {shooter.he} {shooter~fires|fire}.', mixed: 'The officers reach {worker.him} under fire, and one of them may be hit.', adverse: 'The officers don’t reach {worker.him} in time. {worker.first} is killed, and one of them may be hit.' },
          outcomes: {
            favorable: [{ text: 'The officers reach the {scene} in a rush. {shooter.He} {shooter~drops|drop} the handgun. {worker.first} walks out between them.', safe: ['worker'], out: ['shooter'], next: { ending: 'taken' }, objective: 40 }],
            mixed: [{ text: 'The officers reach the {scene}. {shooter.He} {shooter~fires|fire} once. {worker.first} gets out, and the team has {shooter.first}.', fire: { from: 'shooter' }, safe: ['worker'], out: ['shooter'], next: { ending: 'taken' }, objective: 26 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} as the first officer reaches the doorway, then {shooter~turns|turn} back. {worker.first} dies in the {scene}, and the rest of the team has {shooter.him}.', fire: { from: 'shooter' }, harm: { worker: 'fatal' }, out: ['shooter'], next: { ending: 'worker_killed' }, objective: 3 }],
          } },
        { id: 'talk_through', title: 'Shout to {shooter.him} through the building', icon: 'radio', talksTo: 'shooter', check: check(TALK, 14), minutes: 2, stress: 4, consequenceLevel: 'severe',
          summary: '{lead} shouts to {shooter.him} from the front door, by name, so {shooter.he} {shooter~has|have} someone to answer before {shooter.he} {shooter~does|do} anything else. Nobody is in the room with {worker.him} if {shooter.he} {shooter~doesn’t|don’t}.',
          preview: { favorable: '{shooter.He} {shooter~answers|answer}, and {shooter~lets|let} {worker.him} go.', mixed: '{shooter.He} {shooter~shoves|shove} {worker.him} out and {shooter~stays|stay} in the {scene}.', adverse: '{shooter.He} {shooter~doesn’t|don’t} answer, and {worker.first} is killed.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~answers|answer}. After a long minute {shooter.he} {shooter~tells|tell} {worker.first} to go. {worker.He} {worker~walks|walk} out to the team with {worker.his} hands over {worker.his} ears.', safe: ['worker'], next: { node: 'last_man' }, objective: 36 }],
            mixed: [{ text: '{shooter.He} {shooter~shoves|shove} {worker.first} out of the {scene} so hard {worker.he} {worker~falls|fall} in the corridor. {worker.He} {worker~gets|get} outside on {worker.his} own, and the medic checks {worker.him} over. {shooter.He} {shooter~stays|stay} in the {scene}.', safe: ['worker'], next: { node: 'last_man' }, objective: 22 }],
            adverse: [{ text: '{shooter.He} {shooter~doesn’t|don’t} answer. One shot. {worker.first} dies in the {scene}. {shooter.He} {shooter~comes|come} out a minute later with {shooter.his} hands open, and the team has {shooter.him}.', harm: { worker: 'fatal' }, out: ['shooter'], next: { ending: 'worker_killed' }, objective: 5 }],
          } },
      ] },
    { id: 'standoff', stage: 'resolve',
      prompt: '{shooter.He} {shooter~is|are} behind the counter, and {worker.first} is still locked in the {scene}. {shooter.He} won’t pick up the counter phone.',
      promptIf: [{ when: { marks: ['talking'] }, prompt: '{shooter.He} {shooter~is|are} talking on the counter phone from behind the counter. {worker.first} is still locked in the {scene}.' }],
      choices: [
        { id: 'trade_box', title: 'Offer {shooter.him} a way out without the box', icon: 'handover', talksTo: 'shooter', check: check(TALK), minutes: 8,
          summary: '{lead} lays out how {shooter.he} {shooter~walks|walk} out and what happens after, with no car and no deal. That is less than {shooter.he} {shooter~wants|want}.',
          preview: { favorable: '{shooter.He} {shooter~decides|decide} to come out.', mixed: '{shooter.He} {shooter~keeps|keep} you on the phone for hours, and {worker.his} door has to hold that long.', adverse: '{shooter.He} {shooter~hears|hear} “no car” and {shooter~goes|go} back to {worker.his} door, and it may not hold.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~asks|ask} twice whether {shooter.he} will be hurt. Then {shooter.he} {shooter~says|say} {shooter.he} {shooter~is|are} coming out the front.', next: { node: 'coming_out' }, objective: 18, pressure: -8 }],
            mixed: doorFork('{shooter.He} {shooter~keeps|keep} the team on the phone for an hour, then {shooter~hangs|hang} up and {shooter~goes|go} back to {worker.his} door. The frame gives.',
              { text: '{shooter.He} {shooter~keeps|keep} the team on the phone until two in the morning. Then {shooter.he} {shooter~says|say} {shooter.he} {shooter~is|are} coming out.', next: { node: 'coming_out' }, objective: 14, minutes: 40 }),
            adverse: doorFork('{shooter.He} {shooter~hears|hear} “no car” and {shooter~goes|go} back to {worker.his} door. This time the frame gives.',
              { text: '{shooter.He} {shooter~hears|hear} “no car” and {shooter~kicks|kick} {worker.his} door until it splinters. The bolt holds, and {shooter.he} {shooter~hangs|hang} up.', next: { ending: 'held_inside' }, pressure: 10 }),
          } },
        { id: 'back_way', title: 'Walk {worker.him} out while {shooter.he} {shooter~talks|talk}', icon: 'door', walks: 'worker', check: check(MOVE, 4), minutes: 4, consequenceLevel: 'high', onlyIf: { marks: ['talking'] },
          summary: '{lead} keeps {shooter.first} on the phone while another officer talks {worker.first} through opening {worker.his} door and walking out. If {shooter.he} {shooter~hears|hear} the bolt, {worker.he} {worker~is|are} in the open.',
          preview: { favorable: '{worker.first} is out while {shooter.he} {shooter~is|are} still talking.', mixed: '{worker.first} gets out, and {shooter.he} {shooter~hears|hear} {worker.him} go.', adverse: '{shooter.He} {shooter~hears|hear} {worker.him} and {shooter~catches|catch} {worker.him} in the corridor.' },
          outcomes: {
            favorable: [{ text: '{worker.first} walks out while {shooter.first} is still on the phone, complaining about the lights. Patrol has {worker.him}.', safe: ['worker'], next: { node: 'last_man' }, objective: 38 }],
            mixed: [{ text: '{worker.first} gets out. {shooter.first} hears the door, drops the phone and fires once into the wall.', safe: ['worker'], mark: ['shots_fired'], next: { node: 'last_man' }, objective: 30, pressure: 8 }],
            adverse: [{ text: '{shooter.He} {shooter~hears|hear} the bolt and {shooter~catches|catch} {worker.first} in the corridor. {shooter.He} {shooter~pulls|pull} {worker.him} back into the {scene} with the handgun at {worker.his} side.', next: { node: 'through_door' }, pressure: 14 }],
          } },
        { id: 'night_wait', title: 'Hold until {shooter.he} {shooter~sleeps|sleep} or {shooter~quits|quit}', icon: 'wait', check: check(HOLD, -12), minutes: 60, span: 'All night',
          summary: 'Command keeps the street closed all night. {worker.first} stays behind {worker.his} door, and the team stays on the corner.',
          preview: { favorable: '{shooter.He} {shooter~gives|give} up before morning, if {worker.his} door lasts the night.', mixed: '{shooter.He} {shooter~gives|give} up at first light, if {worker.his} door lasts that long.', adverse: '{shooter.He} {shooter~is|are} still there at the end of the shift, and so is {worker.he}, if {worker.his} door holds.' },
          outcomes: {
            favorable: doorFork('Some time after one, {shooter.he} {shooter~goes|go} back to {worker.his} door. The split frame gives.',
              { text: 'A little after three {shooter.he} {shooter~says|say} {shooter.he} {shooter~is|are} tired and {shooter~asks|ask} how {shooter.he} {shooter~comes|come} out.', next: { node: 'coming_out' }, objective: 14 }),
            mixed: doorFork('Near dawn {shooter.he} {shooter~goes|go} back to {worker.his} door with the extinguisher. The frame gives.',
              { text: 'At first light {shooter.he} {shooter~says|say} {shooter.he} {shooter~is|are} coming out.', next: { node: 'coming_out' }, objective: 10, minutes: 40 }),
            adverse: doorFork('In the small hours {shooter.he} {shooter~goes|go} back to {worker.his} door. The frame gives.',
              { text: '{shooter.He} {shooter~is|are} still behind the counter at the end of the shift. {worker.first} is still behind {worker.his} door.', next: { ending: 'held_inside' } }),
          } },
      ] },
    { id: 'coming_out', stage: 'resolve',
      prompt: '{shooter.He} {shooter~says|say} {shooter.he} {shooter~is|are} coming out. {shooter.He} {shooter~hasn’t|haven’t} said what {shooter.he} {shooter~is|are} doing with the handgun.',
      choices: [
        { id: 'walk_out', title: 'Talk {shooter.him} out with {shooter.his} hands empty', icon: 'radio', talksTo: 'shooter', check: check(TALK, -2), minutes: 5, stress: 3,
          summary: '{lead} tells {shooter.him} exactly how to come out, with the handgun left on the counter and {shooter.his} hands open. If {shooter.he} {shooter~gets|get} it wrong, {shooter.he} {shooter~gets|get} it wrong in front of the team.',
          preview: { favorable: '{shooter.He} {shooter~comes|come} out the way {shooter.he} {shooter~is|are} told.', mixed: '{shooter.He} {shooter~comes|come} out, but with the handgun in {shooter.his} waistband.', adverse: '{shooter.He} {shooter~comes|come} out with the handgun in {shooter.his} hand. The team uses force, and {shooter.he} may be killed.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~leaves|leave} the handgun on the counter and {shooter~walks|walk} out with {shooter.his} hands open, the way the team tells {shooter.him}. The team has {shooter.him}. {worker.first} comes out after.', safe: ['worker'], out: ['shooter'], next: { ending: 'everyone_out' }, objective: 40 }],
            mixed: [{ text: '{shooter.He} {shooter~comes|come} out with the handgun still in {shooter.his} waistband. The team takes it from {shooter.him} on the step. {worker.first} comes out after.', safe: ['worker'], out: ['shooter'], next: { ending: 'everyone_out' }, objective: 34 }],
            adverse: [{ text: '{shooter.He} {shooter~comes|come} out with the handgun in {shooter.his} hand while {worker.first} waits in the {scene}.', safe: ['worker'], force: { on: 'shooter', next: { fatal: { ending: 'subject_killed' }, hurt: { ending: 'subject_shot' }, none: { ending: 'taken' } } }, objective: 18 }],
          } },
        { id: 'her_first_out', title: 'Have {shooter.him} send {worker.first} out first', icon: 'handover', talksTo: 'shooter', check: check(TALK, 2), minutes: 4,
          summary: 'You ask {shooter.him} to let {worker.him} out before {shooter.he} {shooter~comes|come} out {shooter.himself}. It keeps {worker.him} away from the moment {shooter.he} {shooter~steps|step} out, and {shooter~gives|give} {shooter.him} one more minute to change {shooter.his} mind.',
          preview: { favorable: '{worker.first} walks out first, then {shooter.him}.', mixed: '{worker.first} walks out, and {shooter.he} {shooter~stays|stay} inside.', adverse: '{shooter.He} {shooter~changes|change} {shooter.his} mind with {worker.him} still behind the door.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~calls|call} through the door that {worker.he} can go. {worker.first} walks out first. {shooter.He} {shooter~follows|follow} with {shooter.his} hands open, and the team has {shooter.him}.', safe: ['worker'], out: ['shooter'], next: { ending: 'everyone_out' }, objective: 42 }],
            mixed: [{ text: '{worker.first} walks out. {shooter.He} {shooter~says|say} {shooter.he} {shooter~needs|need} another minute and {shooter~sits|sit} back down behind the counter.', safe: ['worker'], next: { node: 'last_man' }, objective: 32 }],
            adverse: [{ text: '{shooter.He} {shooter~says|say} {shooter.he} changed {shooter.his} mind and nobody is going anywhere. {worker.first} is still behind {worker.his} door.', next: { ending: 'held_inside' }, pressure: 10 }],
          } },
      ] },
    { id: 'last_man', stage: 'resolve',
      prompt: '{worker.first} is outside with the medic. {shooter.He} {shooter~is|are} alone inside with the handgun.',
      choices: [
        { id: 'last_talk', title: 'Talk {shooter.him} out', icon: 'radio', talksTo: 'shooter', check: check(TALK, 4), minutes: 8,
          modifiers: [{ label: '{shooter.He} {shooter~has|have} already fired', mark: 'shots_fired', value: -6 }],
          summary: '{lead} tells {shooter.him} how to come out, hands open, with nobody left inside to bargain with. {shooter.He} can wait as long as {shooter.he} {shooter~likes|like} now, and {shooter.he} {shooter~knows|know} it.',
          preview: { favorable: '{shooter.He} {shooter~comes|come} out with {shooter.his} hands open.', mixed: '{shooter.He} {shooter~comes|come} out after an hour on the phone.', adverse: '{shooter.He} won’t come out.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~leaves|leave} the handgun on the counter and {shooter~walks|walk} out with {shooter.his} hands open. The team has {shooter.him}.', out: ['shooter'], next: { ending: 'everyone_out' }, objective: 30 }],
            mixed: [{ text: 'An hour on the phone, then {shooter.he} {shooter~walks|walk} out with {shooter.his} hands open. The team has {shooter.him}.', out: ['shooter'], next: { ending: 'everyone_out' }, objective: 24, minutes: 40 }],
            adverse: [{ text: '{shooter.He} {shooter~says|say} {shooter.he} {shooter~is|are} not walking out to anybody. Command keeps the building surrounded.', next: { ending: 'alone_inside' } }],
          } },
        { id: 'last_wait', title: 'Hold and let {shooter.him} decide', icon: 'wait', check: check(HOLD, -12), minutes: 50, span: 'All night',
          summary: 'Command keeps the street closed with nobody inside but {shooter.him}. Your squad stays on the corner for as long as that takes.',
          preview: { favorable: '{shooter.He} {shooter~walks|walk} out before morning.', mixed: '{shooter.He} {shooter~walks|walk} out at first light.', adverse: '{shooter.He} {shooter~is|are} still inside at the end of the shift.' },
          outcomes: {
            favorable: [{ text: '{shooter.He} {shooter~walks|walk} out a little after two with {shooter.his} hands open. The team has {shooter.him}.', out: ['shooter'], next: { ending: 'out_by_morning' }, objective: 26 }],
            mixed: [{ text: '{shooter.He} {shooter~walks|walk} out at first light with {shooter.his} hands open. The team has {shooter.him}.', out: ['shooter'], next: { ending: 'out_by_morning' }, objective: 22, minutes: 30 }],
            adverse: [{ text: '{shooter.He} {shooter~is|are} still behind the counter at the end of the shift. Command keeps the street closed.', next: { ending: 'alone_inside' } }],
          } },
      ] },
  ],
  endings: {
    everyone_out: { title: 'Everyone walked out', disposition: 'resolved',
      summary: '{worker.first} is safe outside, and {shooter.first} is with the team now. What happens next is not this call’s to decide. {worker.first} keeps asking whether anyone has called {worker.his} manager.' },
    out_by_morning: { title: 'Out after a long night', disposition: 'resolved',
      summary: '{worker.first} left hours ago. {shooter.first} walked out to the team after a long night and is with them now.' },
    taken: { title: '{shooter.first} taken, unhurt', disposition: 'resolved',
      summary: '{worker.first} is safe outside, and {shooter.first} is with the team now, unhurt. The entry goes to review. {worker.first} sits on the curb with a patrol blanket around {worker.him}.' },
    subject_shot: { title: '{shooter.first} is with the medic', disposition: 'resolved',
      summary: '{shooter.first} is with the medic, hurt when the team used force, and alive. {worker.first} is safe outside. The use of force goes to review.' },
    subject_killed: { title: '{shooter.first} died at the counter', disposition: 'resolved',
      summary: '{shooter.first} died behind the counter when the team fired as {shooter.he} raised the handgun. {worker.first} is safe outside and hasn’t said a word since. The shooting goes to review.' },
    worker_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{worker.first} is with the medic, hurt but out of the building. {shooter.first} is with the team now. {worker.His} manager is on the way to the hospital.' },
    worker_killed: { title: '{worker.He} didn’t come out', disposition: 'relief_partial',
      summary: '{worker.first} died in the {scene} before the team reached {worker.him}. {shooter.first} is with the team now. {worker.His} phone is still on the floor where {worker.he} dropped it, open to the 911 call.' },
    held_inside: { title: 'Still behind {worker.his} door', disposition: 'relief_partial', remainingTasks: ['Get {worker.first} out of the {scene}', 'Bring {shooter.first} out alive'],
      summary: 'Command still holds the street. {worker.first} is still behind the {scene} door, and {shooter.first} is still inside with the handgun.' },
    alone_inside: { title: 'Alone inside', disposition: 'relief_partial', remainingTasks: ['Bring {shooter.first} out alive'],
      summary: '{worker.first} is safe outside. {shooter.first} is alone in {place} with the handgun, and command still holds the street.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get everyone out of {place} safely'],
      summary: 'Command still holds the street, and the call is still open. The team has no step left that it can take from here.' },
  },
  rewards: { funding: 3200, devPoints: 4, trust: 8, xp: 55 },
  squads: { min: 1, max: 3 },
};
