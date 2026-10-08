import type { CallTree, TreeChoice, TreeOutcome } from './types';

// My Chair Comes Too, as a call tree. A resident who uses a wheelchair is in a house across the
// street from a man firing from an upstairs window. A neighbor told dispatch the resident "won't
// leave"; the truth is they won't leave without their chair. The power on the block is out.
// Hidden truth: whether the man can see their front door (sees_door) and whether their oxygen
// runs short without power (oxygen_low). In one situation moving now is right, in one waiting is
// right, and in one both cost something and only cover or courage gets them out. The short tank is
// a clock (content/incidents/rescue.ts): waits read its gauge, and the longest wait reads it empty.
//
// The shooter across the street is another unit's problem, contained by patrol; this team's job is
// the person. Deaths (E2.2): the resident can die crossing open ground under fire. One plain
// sentence, their state first.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
const RUSH = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.5 }, { key: 'composure', weight: 0.5 }] } as const;
const DRIVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.7 }, { key: 'awareness', weight: 0.3 }] } as const;
type Base = typeof TALK | typeof HOLD | typeof MOVE | typeof RUSH | typeof DRIVE;
const check = (base: Base, difficulty = 0): TreeChoice['check'] => ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

/** Open ground in front of the house: if he can see the door, movement there draws fire. */
const doorway = (seen: TreeOutcome, unseen: TreeOutcome): TreeOutcome[] => [
  { if: { fact: 'sees_door', is: true }, ...seen, reveal: ['sees_door'] },
  { if: { fact: 'sees_door', is: false }, ...unseen, reveal: ['sees_door'] },
];
/** Asking about the oxygen: the resident tells you what the tank has in it. */
const breath = (short: TreeOutcome, fine: TreeOutcome): TreeOutcome[] => [
  { if: { fact: 'oxygen_low', is: true }, ...short, reveal: ['oxygen_low'] },
  { if: { fact: 'oxygen_low', is: false }, ...fine, reveal: ['oxygen_low'] },
];
/** Time spent waiting: if the tank's gauge is in the red by the end of the wait, the wait itself
 * becomes the danger. A full tank never gets there. */
const gauge = (short: TreeOutcome, fine: TreeOutcome): TreeOutcome[] => [
  { if: { clock: 'oxygen', low: true }, ...short, reveal: ['oxygen_low'] },
  { if: { clock: 'oxygen', low: false }, ...fine },
];
/** Once the tank has run out with {resident.first} still inside, the engine records {resident.him}
 * hurt and marks `tank_empty` (content/incidents/rescue.ts, onOut). A crossing that goes well then
 * still ends with {resident.him} hurt: `tankEmpty` takes that state, and `tankFull` keeps the
 * outcomes written for a resident who still has air. */
const tankFull = (outcomes: TreeOutcome[]): TreeOutcome[] => outcomes.map(outcome => ({ ...outcome, when: { ...outcome.when, notMarks: [...outcome.when?.notMarks ?? [], 'tank_empty'] } }));
const tankEmpty = (text: string, objective: number): TreeOutcome => ({ when: { marks: ['tank_empty'] }, text, safe: ['resident'], next: { ending: 'resident_hurt' }, objective });
/** The longest wait: whether the tank runs out before the shooting stops. */
const empty = (out: TreeOutcome, lasts: TreeOutcome): TreeOutcome[] => [
  { if: { clock: 'oxygen', out: true }, ...out, reveal: ['oxygen_low'], mark: [...out.mark ?? [], 'tank_empty'] },
  { if: { clock: 'oxygen', out: false }, ...lasts },
];

export const RESCUE_CHAIR: CallTree = {
  type: 'protected_rescue',
  title: 'My Chair Comes Too',
  roles: [
    { id: 'resident', label: 'resident', pronouns: 'they', kind: 'civilian', mobility: 'chair' },
    { id: 'neighbor', label: 'the neighbor who called', pronouns: 'she', kind: 'bystander' },
    { id: 'shooter', label: 'the person firing across the street', pronouns: 'he', kind: 'subject', place: 'offsite' },
  ],
  // Houses only: the crossing is a porch, a step, a lawn and a hedge, which flats and apartment
  // units don't have.
  families: ['cedar_close', 'willow_terrace_v1', 'ash_grove_v1', 'juniper_court_v1', 'bungalow_g2', 'two_storey_house_g2', 'semi_detached_g2'],
  scene: { setting: 'residential', rooms: ['living', 'bedroom'], timeOfDay: 'dusk' },
  summary: '{resident} is in {resident.his} front room across from someone firing from a window. A neighbor told dispatch {resident.he} won’t leave.',
  pressureLabel: '{resident.first} in the front room',
  pressure: { start: 26, perMinute: 0.35, threshold: 80, civilianPerMinute: 0.6 },
  briefing: {
    dispatchReason: 'Someone is firing from an upstairs window across the street. Patrol is holding {shooter.his} house, and {resident}, who uses a wheelchair, can’t leave {resident.hers} without help.',
    known: [
      '{neighbor.first} told dispatch, “{resident.first} won’t leave.” {neighbor.He} {neighbor~hasn’t|haven’t} said why.',
      'The power on the block went out ten minutes ago. Patrol heard shots at a car on this side of the street.',
      'The only way out that takes a wheelchair is the front door.',
    ],
    unknown: ['Whether the shooter across the street can see {resident.first}’s front door'],
    responsibilities: ['Get {resident.first} out alive', 'Ask {resident.first} what {resident.he} {resident~needs|need}, and listen', 'Keep {neighbor.first} behind the patrol cars'],
  },
  stageLabels: { assess: 'Won’t leave', adapt: '{resident.His} terms', resolve: 'The front door' },
  objectives: [
    { id: 'resident', label: 'Get {resident.first} out alive' },
    { id: 'chair', label: 'Bring the chair' },
  ],
  facts: {
    shots: { public: true, truth: true, source: 'Responding patrol', label: 'Shots from across the street',
      claim: 'Patrol saw someone firing at cars from an upstairs window across the street.', confirmed: 'Patrol saw {shooter.him} fire again from the same window.', disproved: 'Patrol could not see the window.',
      // Reported from the first minute. The only choice that asks for entry is carrying the resident
      // out against what they asked (carry), and this is command's reason for it.
      threat: 'rounds are hitting this side of the street' },
    sees_door: { label: '{shooter.His} view of the front door', claim: 'Whether the shooter across the street can see {resident.first}’s front door.',
      confirmed: '{shooter.He} can see the front door from {shooter.his} window. Anything that moves there is in {shooter.his} view.', disproved: 'A tree blocks {shooter.his} view of the front door.' },
    oxygen_low: { label: '{resident.first}’s oxygen', claim: 'How long {resident.first}’s oxygen lasts without power.',
      confirmed: '{resident.first} says the concentrator stopped with the power, and the spare tank has about forty minutes.', disproved: '{resident.first} says the spare tank is full and good for hours.' },
  },
  situations: [
    { note: '{shooter.He} can’t see the door, and the tank is full. Moving now is safe; waiting only costs time.', truth: { sees_door: false, oxygen_low: false } },
    { note: '{shooter.He} can see the door, and the tank is full. Waiting is right; the door is where people get hurt.', truth: { sees_door: true, oxygen_low: false } },
    { note: '{shooter.He} can see the door, and the tank is running out. Neither waiting nor walking out is free.', truth: { sees_door: true, oxygen_low: true } },
  ],
  turns: { waiting: ['lights_on', 'quiet_window', 'neighbor_runs'] },
  difficulty: { base: 40, perTier: 2 },
  root: 'wont_leave',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'wont_leave', stage: 'assess',
      prompt: 'Another shot hits a parked car on this side. {neighbor.first} says {resident.first} told {neighbor.him} no twice and wouldn’t say why.',
      choices: [
        { id: 'ask_them', title: 'Call {resident.first} and ask what {resident.he} {resident~needs|need}', icon: 'radio', talksTo: 'resident', check: check(TALK, -4), minutes: 4,
          summary: '{lead} calls {resident.first} and asks, then listens. Everyone stays put while you do, and the shooter across the street keeps firing.',
          preview: { favorable: '{resident.first} tells you what {resident.he} {resident~needs|need} to leave.', mixed: '{resident.first} tells you, and says {resident.he} told {neighbor.first} three times already.', adverse: '{resident.first} won’t pick up, and two officers have to cross the open street to reach {resident.him}.' },
          outcomes: {
            favorable: [
              ...breath({ text: '{resident.first} picks up on the second ring. {resident.He} will leave, with the chair. The concentrator died with the power, and the spare tank has about forty minutes.', mark: ['chair_matters'], next: { node: 'their_terms' }, objective: 14 },
                { text: '{resident.first} picks up on the second ring. {resident.He} will leave, but not without the chair. The spare oxygen tank is full.', mark: ['chair_matters'], next: { node: 'their_terms' }, objective: 14 }),
            ],
            mixed: [
              ...breath({ text: '{resident.first} says {resident.he} told {neighbor.first} three times {resident.he} will go if the chair goes. The spare tank has about forty minutes.', mark: ['chair_matters', 'stung'], next: { node: 'their_terms' }, objective: 8 },
                { text: '{resident.first} says {resident.he} told {neighbor.first} three times {resident.he} will go if the chair goes, and nobody listened.', mark: ['chair_matters', 'stung'], next: { node: 'their_terms' }, objective: 8 }),
            ],
            adverse: [{ text: '{resident.first} doesn’t pick up. Two officers cross to the door to reach {resident.him}, and a round goes through the hedge as they get there.', mark: ['seen_crossing'], next: { node: 'at_the_door' }, pressure: 6 }],
          } },
        { id: 'go_get', title: 'Send two officers to {resident.his} door', icon: 'door', check: check(RUSH, 4), minutes: 3, stress: 4, consequenceLevel: 'high',
          summary: '{lead} and one other officer cross to the front door before anyone asks {resident.first} anything. You reach {resident.him} fast, and the officers cross the open ground first.',
          preview: { favorable: 'The officers reach the front door before the next shot.', mixed: 'The officers reach the door with a shot through the hedge beside them.', adverse: 'An officer goes down crossing the open ground, hurt.' },
          outcomes: {
            favorable: [{ text: 'The two officers are at the front door before the next shot. {resident.first} opens it from the chair.', next: { node: 'at_the_door' }, objective: 12 }],
            mixed: [{ text: 'A round goes through the hedge a step behind the second officer. They reach the door, and {resident.first} lets them in.', mark: ['seen_crossing'], next: { node: 'at_the_door' }, objective: 8, pressure: 6 }],
            adverse: doorway(
              { text: '{shooter.He} {shooter~fires|fire} as {resident.he} {resident~crosses|cross}. The second officer is hit in the leg on the lawn and dragged back to the patrol car. Another officer runs across in {resident.his} place.', officer: 'serious', mark: ['seen_crossing'], next: { node: 'at_the_door' }, pressure: 12 },
              { text: 'An officer trips on the dark step and goes down hard on one knee. They reach the door, one of them limping.', officer: 'wounded', next: { node: 'at_the_door' }, pressure: 6 }),
          } },
        { id: 'vehicle', title: 'Screen the door with the rescue vehicle', icon: 'perimeter', requires: { certs: ['vehicle_operations'] }, check: check(DRIVE, -2), minutes: 12,
          summary: 'Twelve minutes in the dark for {resident.first} first. Then the armored vehicle is parked between {shooter.his} window and {resident.his} door.',
          preview: { favorable: 'The vehicle is in place, screening the door.', mixed: 'The vehicle is in place late, and it has taken rounds.', adverse: 'Parked cars keep the vehicle from the curb, and the door stays in the open.' },
          outcomes: {
            favorable: [{ text: 'The vehicle backs up onto the curb, square between the window and the front door.', mark: ['screened'], next: { turn: 'waiting' }, objective: 12 }],
            mixed: [{ text: 'The vehicle gets into place after twenty minutes. Two rounds ring off its side as it parks.', mark: ['screened'], next: { turn: 'waiting' }, objective: 8, minutes: 8, pressure: 4 }],
            adverse: [{ text: 'Parked cars block the curb. The vehicle stops in the street, and the front door is still in the open.', next: { turn: 'waiting' }, pressure: 6 }],
          } },
      ] },

    // ------------------------------------------------------------------ stage 2
    { id: 'their_terms', stage: 'adapt',
      prompt: '{resident.first} will leave with the chair and only with the chair. The front door is the only way it fits.',
      promptIf: [{ when: { marks: ['stung'] }, prompt: '{resident.first} has said it four times now. {resident.He} {resident~leaves|leave} with the chair, by the front door, or not at all.' }],
      choices: [
        { id: 'their_way', title: 'Bring {resident.him} out {resident.his} way', icon: 'door', walks: 'resident', check: check(MOVE, 6), minutes: 4, consequenceLevel: 'high',
          summary: '{lead} wheels {resident.first} out the front, chair and all, the way {resident.he} asked. It is slow over the step, and the doorway may be in {shooter.his} view the whole time.',
          preview: { favorable: '{resident.first} is across the street in {resident.his} chair.', mixed: '{resident.first} gets across, but the step costs a long minute in the open.', adverse: '{resident.first} is hurt in the doorway, by a fall or by {shooter.his} fire.' },
          outcomes: {
            favorable: [{ text: 'The team gets the chair over the step and across the street in under a minute. {resident.first} is behind the patrol cars, still in the chair.', safe: ['resident'], next: { ending: 'out_together' }, objective: 50 }],
            mixed: doorway(
              { text: 'A round hits the porch rail as the chair goes over the step. {resident.first} gets across, still in the chair, and won’t stop shaking.', safe: ['resident'], next: { ending: 'out_together' }, objective: 42 },
              { text: 'The chair sticks on the step for a long minute before it goes over. {resident.first} gets across in it.', safe: ['resident'], next: { ending: 'out_together' }, objective: 44 }),
            adverse: doorway(
              { text: '{shooter.He} {shooter~fires|fire} while the chair is in the doorway. {resident.first} is hit in the shoulder. The team gets {resident.him} across, and the medic has {resident.him}.', safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 18 },
              { text: 'The chair tips on the step, and {resident.first} falls onto the porch. No shot comes. The team gets {resident.him} back in the chair and across, hurt.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 26 }),
          } },
        { id: 'screen_first', title: 'Park the vehicle at the door first', icon: 'perimeter', requires: { certs: ['vehicle_operations'] }, check: check(DRIVE, -4), minutes: 14,
          summary: 'Fourteen minutes in the dark first. Then {resident.first} goes out {resident.his} way, with the armored vehicle parked in front of the door.',
          preview: { favorable: 'The vehicle is in place before anyone moves.', mixed: 'The vehicle gets into place late.', adverse: 'The vehicle can’t reach the curb.' },
          outcomes: {
            favorable: gauge(
              { text: 'The vehicle is in place in fourteen minutes. {resident.first} says the tank gauge has dropped into the red.', mark: ['screened', 'running_low'], next: { node: 'crossing' }, objective: 12 },
              { text: 'The vehicle is in place in fourteen minutes. {resident.first} is ready at the door with {resident.his} bag on {resident.his} lap.', mark: ['screened'], next: { node: 'crossing' }, objective: 14 }),
            mixed: gauge(
              { text: 'The vehicle takes twenty-five minutes to get past the parked cars. By then the tank gauge is deep in the red.', mark: ['screened', 'running_low'], next: { node: 'crossing' }, objective: 8, minutes: 10 },
              { text: 'The vehicle takes twenty-five minutes to get past the parked cars, but it gets there.', mark: ['screened'], next: { node: 'crossing' }, objective: 8, minutes: 10 }),
            adverse: [{ text: 'Parked cars keep the vehicle from the curb. The door is still in the open.', next: { node: 'crossing' }, pressure: 6 }],
          } },
        { id: 'stay_in', title: 'Keep {resident.him} in until the shooting stops', icon: 'wait', check: check(HOLD, -10), minutes: 30, span: 'Hours',
          summary: 'You leave {resident.first} in an inside room with an officer until the shooting across the street stops. That could take all night.',
          preview: { favorable: '{resident.first} waits in the hallway with an officer, if the oxygen lasts.', mixed: '{resident.first} waits, and the wait gets hard.', adverse: '{resident.first} runs short of air, or rounds come through the front of the house.' },
          outcomes: {
            favorable: gauge(
              { text: 'Half an hour in, {resident.first} says the gauge on the tank is in the red.', mark: ['running_low'], next: { node: 'inside_room' }, pressure: 8 },
              { text: '{resident.first} waits in the hallway with an officer and a flashlight. The shooting is slower now.', next: { node: 'inside_room' }, objective: 10 }),
            mixed: gauge(
              { text: '{resident.first} is breathing hard and says the tank won’t last the night.', mark: ['running_low'], next: { node: 'inside_room' }, pressure: 10 },
              { text: '{resident.first} waits, and asks every ten minutes whether anyone has seen the shooter come down.', mark: ['stung'], next: { node: 'inside_room' } }),
            adverse: gauge(
              { text: '{resident.first} is fighting for breath an hour in. The tank is almost empty.', mark: ['running_low'], next: { node: 'inside_room' }, pressure: 14 },
              { text: 'Two rounds come through the front window an hour in. Nobody is in that room.', next: { node: 'inside_room' }, pressure: 8 }),
          } },
      ] },
    { id: 'at_the_door', stage: 'adapt',
      prompt: 'Two officers are inside. {resident.first} won’t move without the chair, and nobody has asked why.',
      promptIf: [{ when: { marks: ['seen_crossing'] }, prompt: 'The officers are inside, and {shooter.he} saw them cross. {resident.first} won’t move without the chair.' }],
      choices: [
        { id: 'carry', title: 'Carry {resident.him} out and leave the chair', icon: 'door', walks: 'resident', check: check(RUSH, 2), minutes: 2, consequenceLevel: 'high', authority: 'entry',
          summary: 'Two officers lift {resident.first} from the chair and run for the cars, the one thing {resident.first} asked nobody to do.',
          preview: { favorable: '{resident.first} is across the street, carried, without the chair.', mixed: '{resident.first} is across, and is hurt in the lift.', adverse: '{resident.He} {resident~goes|go} down together in the open, and {resident.first} is hurt.' },
          outcomes: {
            favorable: [{ text: 'The officers carry {resident.first} across the street in eight seconds. The chair is still in the front room.', safe: ['resident'], next: { ending: 'out_without_chair' }, objective: 40 }],
            mixed: [{ text: 'The officers get {resident.first} across, but they twist {resident.first}’s hip in the lift. The medic has {resident.him}, and the chair is still inside.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 26 }],
            adverse: doorway(
              { text: '{shooter.He} {shooter~fires|fire} as {resident.he} {resident~crosses|cross}. An officer is hit in the back plate and goes down with {resident.first} on the sidewalk. {resident.first} is hit in the hip, and the medic drags {resident.him} behind the car.', officer: 'wounded', safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 12 },
              { text: 'An officer slips on the wet lawn and they both go down. {resident.first} lands on {resident.his} arm. The team gets {resident.him} across, hurt.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 24 }),
          } },
        { id: 'ask_now', title: 'Stop and ask {resident.first} what {resident.he} {resident~needs|need}', icon: 'radio', talksTo: 'resident', check: check(TALK, -6), minutes: 4,
          summary: 'The officers kneel by the chair and ask. It costs four minutes in a house {shooter.he} may be watching, and you hear it from {resident.him}.',
          preview: { favorable: '{resident.first} tells you what {resident.he} {resident~needs|need} to go.', mixed: '{resident.first} tells you, and asks why nobody asked first.', adverse: '{resident.first} won’t answer, and the minutes go anyway.' },
          outcomes: {
            favorable: breath({ text: '{resident.first} says {resident.he} {resident~goes|go} with the chair. The concentrator died with the power, and the spare tank has forty minutes in it.', mark: ['chair_matters'], next: { node: 'their_terms' }, objective: 12 },
              { text: '{resident.first} says {resident.he} {resident~goes|go} with the chair. The spare oxygen tank is full.', mark: ['chair_matters'], next: { node: 'their_terms' }, objective: 12 }),
            mixed: breath({ text: '{resident.first} asks why nobody asked first. {resident.He} {resident~goes|go} with the chair, and the tank has forty minutes.', mark: ['chair_matters', 'stung'], next: { node: 'their_terms' }, objective: 8 },
              { text: '{resident.first} asks why nobody asked first. {resident.He} {resident~goes|go} with the chair, and not before.', mark: ['chair_matters', 'stung'], next: { node: 'their_terms' }, objective: 8 }),
            adverse: [{ text: '{resident.first} grips the wheels and won’t answer. A round hits the front of the house.', mark: ['chair_matters'], next: { node: 'their_terms' }, pressure: 8 }],
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: waiting for the vehicle (one turn per call)
    { id: 'lights_on', stage: 'adapt',
      prompt: 'The power comes back. {resident.first}’s concentrator starts up, and so does the porch light over {resident.his} front door.',
      choices: [
        { id: 'light_off', title: 'Get the porch light off first', icon: 'radio', talksTo: 'resident', check: check(TALK, -2), minutes: 3,
          summary: '{lead} talks {resident.first} through finding the switch. Until it is off, the doorway is the brightest thing on the street.',
          preview: { favorable: 'The light is off, and the door is dark again.', mixed: 'The light goes off after a long minute.', adverse: '{resident.first} can’t reach the switch, and the doorway stays lit.' },
          outcomes: {
            favorable: [{ text: '{resident.first} reaches the switch from the chair. The doorway goes dark again.', next: { node: 'crossing' }, objective: 10 }],
            mixed: [{ text: 'The switch is behind the coat rack. It takes {resident.first} two minutes, and a round hits the street while it is on.', next: { node: 'crossing' }, pressure: 6 }],
            adverse: [{ text: '{resident.first} can’t reach the switch from the chair. The doorway stays lit.', mark: ['lit_door'], next: { node: 'crossing' }, pressure: 8 }],
          } },
        { id: 'go_while_power', title: 'Go now, before {shooter.he} {shooter~notices|notice} the light', icon: 'door', walks: 'resident', check: check(MOVE, 8), minutes: 4, consequenceLevel: 'severe',
          summary: 'You move before {shooter.he} {shooter~looks|look} at the newly lit doorway. If {shooter.he} {shooter~is|are} already looking, the chair goes out under the brightest light on the street.',
          preview: { favorable: '{resident.first} is across before {shooter.he} {shooter~looks|look}.', mixed: '{resident.first} is across, after a long moment under the light.', adverse: 'It goes wrong under the light. {resident.first} can be hurt or killed.' },
          outcomes: {
            favorable: [{ text: 'The team gets {resident.first} across under the porch light before the next shot. Still in the chair.', safe: ['resident'], next: { ending: 'out_together' }, objective: 46 }],
            mixed: doorway({ text: 'A round hits the doorframe as the chair goes through. {resident.first} gets across, still in the chair.', safe: ['resident'], next: { ending: 'out_together' }, objective: 38 },
              { text: 'The chair catches on the doormat under the light, then goes. {resident.first} gets across.', safe: ['resident'], next: { ending: 'out_together' }, objective: 42 }),
            adverse: doorway({ text: '{shooter.He} {shooter~fires|fire} at the lit doorway. {resident.first} is hit in the chair, on the porch. The medic works on {resident.him} in the street and {resident.he} {resident~dies|die} there.', harm: { resident: 'fatal' }, next: { ending: 'resident_killed' }, objective: 5 },
              { text: 'The chair tips on the lit step. {resident.first} falls and hits {resident.his} head on the rail. The team gets {resident.him} across, hurt.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 24 }),
          } },
      ] },
    { id: 'quiet_window', stage: 'adapt',
      prompt: 'The shooting has stopped. Nobody can see the shooter in the window anymore.',
      choices: [
        { id: 'go_in_quiet', title: 'Use the quiet and go now', icon: 'door', walks: 'resident', check: check(MOVE, 4), minutes: 4, consequenceLevel: 'high',
          summary: '{lead} moves {resident.first} out while it is quiet. Quiet can mean {shooter.he} {shooter~is|are} gone, or reloading, or watching.',
          preview: { favorable: '{resident.first} is across while it is still quiet.', mixed: '{resident.first} is across, and the shooting starts again behind {resident.him}.', adverse: 'The shooting starts again while the chair is in the open, and {resident.first} is hurt.' },
          outcomes: {
            favorable: [{ text: '{resident.first} crosses the street in the quiet, in the chair. Nobody fires.', safe: ['resident'], next: { ending: 'out_together' }, objective: 46 }],
            mixed: [{ text: 'The shooting starts again as the chair reaches the patrol cars. {resident.first} is behind {resident.him}, safe.', safe: ['resident'], next: { ending: 'out_together' }, objective: 40, pressure: 6 }],
            adverse: doorway({ text: 'The shooting starts again while the chair is in the street. {resident.first} is hit. The team gets {resident.him} behind the cars, and the medic has {resident.him}.', safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 16 },
              { text: 'The shooting starts again at the far end of the block. The team runs the chair across, and {resident.first} is thrown forward at the curb, hurt.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 24 }),
          } },
        { id: 'watch_window', title: 'Wait until patrol can see {shooter.him} again', icon: 'search', check: check(HOLD, -6), minutes: 15,
          summary: 'Nobody moves until patrol has eyes on the window again. If {shooter.he} {shooter~has|have} gone somewhere else, nobody knows where.',
          preview: { favorable: 'Patrol sees {shooter.him} again, still at the window.', mixed: 'Patrol finds {shooter.him} at a different window.', adverse: 'Nobody finds {shooter.him}, and the wait goes on.' },
          outcomes: {
            favorable: [{ text: 'Patrol sees {shooter.him} at the same window, reloading. Now everyone knows where {shooter.he} {shooter~is|are}.', mark: ['eyes_on'], next: { node: 'crossing' }, objective: 10 }],
            mixed: gauge({ text: 'Patrol finds {shooter.him} at a window further down. {resident.first} says the tank gauge is low.', mark: ['eyes_on', 'running_low'], next: { node: 'crossing' }, pressure: 8 },
              { text: 'Patrol finds {shooter.him} at a window further down, closer to {resident.first}’s door.', mark: ['eyes_on'], next: { node: 'crossing' }, pressure: 6 }),
            adverse: gauge({ text: 'Nobody finds {shooter.him} for fifteen minutes. {resident.first} is breathing hard, and the tank is low.', mark: ['running_low'], next: { node: 'crossing' }, pressure: 12 },
              { text: 'Nobody finds {shooter.him} for fifteen minutes. {resident.first} is still waiting at the door.', next: { node: 'crossing' }, pressure: 6 }),
          } },
      ] },
    { id: 'neighbor_runs', stage: 'adapt',
      prompt: '{neighbor.first} is running across the street toward {resident.first}’s door, shouting that {neighbor.he}’ll bring {resident.him} {neighbor.himself}.',
      choices: [
        { id: 'stop_her', title: 'Stop {neighbor.first} in the street', icon: 'perimeter', check: check(RUSH, 2), minutes: 2, stress: 4, consequenceLevel: 'high',
          summary: 'An officer goes after {neighbor.first} into the open street. {neighbor.He} {neighbor~is|are} safe if the officer catches {neighbor.him}, and the officer is in the open until then.',
          preview: { favorable: 'The officer brings {neighbor.first} back behind the cars.', mixed: '{neighbor.first} comes back, fighting the officer the whole way.', adverse: '{shooter.He} {shooter~fires|fire} at the two of them in the street, and the officer is hit.' },
          outcomes: {
            favorable: [{ text: 'The officer catches {neighbor.first} halfway and walks {neighbor.him} back behind the cars. {neighbor.He} {neighbor~is|are} crying.', next: { node: 'crossing' }, objective: 8 }],
            mixed: [{ text: '{neighbor.first} fights the officer all the way back. {resident.first} watched the whole thing from the window.', mark: ['stung'], next: { node: 'crossing' }, pressure: 6 }],
            adverse: [{ text: '{shooter.He} {shooter~fires|fire} at the two of them. The officer is hit in the arm and gets {neighbor.first} behind the cars anyway.', officer: 'wounded', next: { node: 'crossing' }, pressure: 12 }],
          } },
        { id: 'call_her_back', title: 'Shout {neighbor.him} back from cover', icon: 'radio', check: check(TALK, 4), minutes: 1,
          summary: '{lead} shouts to {neighbor.first} from behind the patrol car. Nobody else goes into the street, and {neighbor.he} might not listen.',
          preview: { favorable: '{neighbor.first} stops and comes back.', mixed: '{neighbor.first} stops at the curb and won’t come back.', adverse: '{neighbor.first} keeps going toward the door.' },
          outcomes: {
            favorable: [{ text: '{neighbor.first} stops in the street, turns and comes back. {neighbor.He} {neighbor~sits|sit} down hard on the curb.', next: { node: 'crossing' }, objective: 6 }],
            mixed: [{ text: '{neighbor.first} stops at the far curb and stays there, in the open, refusing to come back.', mark: ['neighbor_close'], next: { node: 'crossing' }, pressure: 8 }],
            adverse: doorway({ text: '{neighbor.first} keeps going. {shooter.He} {shooter~fires|fire} into the street, and {neighbor.he} {neighbor~throws|throw} {neighbor.himself} flat at the bottom of {resident.first}’s steps. {neighbor.He} {neighbor~is|are} not hit, and {neighbor.he} won’t move.', mark: ['neighbor_close'], next: { node: 'crossing' }, pressure: 14 },
              { text: '{neighbor.first} reaches the door and bangs on it, shouting. Nobody fires. {neighbor.He} won’t come away from it.', mark: ['neighbor_close'], next: { node: 'crossing' }, pressure: 8 }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'crossing', stage: 'resolve',
      prompt: 'Two officers are at the door with {resident.first} in the chair. Thirty feet of open street lies between {resident.him} and the cars.',
      promptIf: [
        { when: { marks: ['tank_empty'] }, prompt: 'The tank is empty now. Two officers hold {resident.first}’s chair at the door, facing the street.' },
        { when: { marks: ['running_low', 'screened'] }, prompt: '{resident.first}’s tank is in the red. The armored vehicle is parked between {shooter.his} window and the door.' },
        { when: { marks: ['running_low'] }, prompt: '{resident.first}’s tank is in the red. Thirty feet of open street lies between the door and the patrol cars.' },
        { when: { marks: ['screened'] }, prompt: 'The armored vehicle is parked between {shooter.his} window and the door. {resident.first} is at the door in the chair.' },
        { when: { marks: ['neighbor_close'] }, prompt: '{neighbor.first} is out in the street by the steps, and won’t move. {resident.first} is at the door in the chair.' },
        { when: { marks: ['lit_door'] }, prompt: 'The porch light is still on. {resident.first} is in the lit doorway, in the chair.' },
      ],
      choices: [
        { id: 'cross_now', title: 'Cross now, chair and all', icon: 'door', walks: 'resident', check: check(MOVE, 6), minutes: 3, consequenceLevel: 'severe',
          modifiers: [{ label: 'The vehicle screens the door', mark: 'screened', value: 14 }, { label: 'Patrol can see where {shooter.he} {shooter~is|are}', mark: 'eyes_on', value: 6 }, { label: 'The doorway is lit', mark: 'lit_door', value: -10 }, { label: '{resident.first} told you how {resident.he} {resident~wants|want} to go', mark: 'chair_matters', value: 4 }],
          summary: 'The team wheels {resident.first} across the street at a run. It is the way {resident.he} asked to go, and the chair is slow on the curb.',
          preview: { favorable: '{resident.first} is across the street in the chair.', mixed: '{resident.first} is across, after a bad moment at the curb.', adverse: 'It goes wrong in the street. {resident.first} can be hurt or killed.' },
          outcomes: {
            favorable: [...tankFull([{ text: 'The team runs the chair across the street and up behind the patrol cars. {resident.first} is still holding {resident.his} bag.', safe: ['resident'], next: { ending: 'out_together' }, objective: 50 }]),
              tankEmpty('Two officers rush {resident.first} over the open street, {resident.his} head down on the empty tank. The medic has a mask on {resident.first} behind the cars.', 30)],
            mixed: [...tankFull(doorway({ text: 'A round hits the street behind the chair. {resident.first} gets across, and grips the officer’s sleeve for a long time.', safe: ['resident'], next: { ending: 'out_together' }, objective: 42 },
              { text: 'The chair catches on the curb and an officer lifts the front wheels over it. {resident.first} gets across.', safe: ['resident'], next: { ending: 'out_together' }, objective: 44 })),
              tankEmpty('The chair jams against the curb with {resident.first} limp in the seat. Two officers heave the chair clear, and the medic kneels in the road with the oxygen.', 24)],
            adverse: [
              { if: { fact: 'sees_door', is: true }, when: { notMarks: ['screened'] }, text: '{shooter.He} {shooter~fires|fire} while the chair is in the street. {resident.first} is hit and dies before the medic reaches {resident.him} behind the cars. An officer is hit in the vest.', reveal: ['sees_door'], officer: 'wounded', harm: { resident: 'fatal' }, next: { ending: 'resident_killed' }, objective: 5 },
              { if: { fact: 'sees_door', is: true }, when: { marks: ['screened'] }, text: '{shooter.He} {shooter~fires|fire} over the vehicle as the chair comes around it. A round catches {resident.first} in the arm. The medic has {resident.him} behind the cars.', reveal: ['sees_door'], safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 18 },
              { if: { fact: 'sees_door', is: false }, text: 'The chair tips at the curb, and {resident.first} falls into the gutter. No shot comes. The team gets {resident.him} across, hurt.', reveal: ['sees_door'], safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 24 },
            ],
          } },
        { id: 'cross_carried', title: 'Carry {resident.him} across fast, chair after', icon: 'door', walks: 'resident', check: check(RUSH, 2), minutes: 2, consequenceLevel: 'high',
          modifiers: [{ label: 'The vehicle screens the door', mark: 'screened', value: 10 }],
          summary: 'Two officers carry {resident.first} and a third brings the empty chair. Faster across the open, and {resident.first} is lifted out of {resident.his} own chair to do it.',
          preview: { favorable: '{resident.first} is across, carried, and the chair comes after.', mixed: '{resident.first} is across, hurt in the lift.', adverse: 'Someone goes down in the street. An officer or {resident.first} is hurt.' },
          outcomes: {
            favorable: [...tankFull([{ text: 'The officers carry {resident.first} across in a few strides. The third officer brings the chair. {resident.first} doesn’t look at any of {resident.him}.', safe: ['resident'], next: { ending: 'out_carried' }, objective: 44 }]),
              tankEmpty('{resident.first} hangs between two officers all the way across. The chair stays in the front hall, and the medic is waiting at the curb with the ambulance’s tank.', 28)],
            mixed: [{ text: 'The officers get {resident.first} across, but they wrench {resident.first}’s shoulder in the lift. The medic has {resident.him}, and the chair comes after.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 26 }],
            adverse: doorway({ text: '{shooter.He} {shooter~fires|fire} at the officers carrying {resident.first}. One is hit in the leg. They get {resident.first} across, and the officer is dragged in after.', officer: 'serious', safe: ['resident'], next: { ending: 'out_carried' }, objective: 30 },
              { text: 'An officer’s foot goes into a pothole. {resident.first} is dropped onto the street and hurt. The team gets {resident.him} across.', safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 22 }),
          } },
        { id: 'neighbor_first', title: 'Get {neighbor.first} off the street first', icon: 'perimeter', check: check(RUSH, 2), minutes: 3, stress: 4, consequenceLevel: 'high', onlyIf: { marks: ['neighbor_close'] },
          summary: 'An officer goes out to bring {neighbor.first} back before anyone moves the chair. {resident.first} waits inside while the officer is in the open.',
          preview: { favorable: 'The officer brings {neighbor.first} back, and {resident.first} waits inside.', mixed: '{neighbor.first} comes back fighting, and {resident.first} waits inside.', adverse: '{shooter.He} {shooter~fires|fire} at the officer bringing {neighbor.him} back.' },
          outcomes: {
            favorable: [{ text: 'The officer walks {neighbor.first} back behind the cars. {resident.first} goes back to the hallway to wait.', next: { node: 'inside_room' }, objective: 8 }],
            mixed: [{ text: '{neighbor.first} fights the officer all the way back. {resident.first} goes back to the hallway, saying nobody listens to either of {resident.him}.', mark: ['stung'], next: { node: 'inside_room' }, pressure: 6 }],
            adverse: doorway({ text: '{shooter.He} {shooter~fires|fire} at the officer, who is hit in the arm and gets {neighbor.first} behind the cars anyway. {resident.first} goes back to the hallway.', officer: 'wounded', next: { node: 'inside_room' }, pressure: 12 },
              { text: 'The officer slips on the steps getting {neighbor.him} up and is hurt. They both make it back. {resident.first} goes back to the hallway.', officer: 'wounded', next: { node: 'inside_room' }, pressure: 6 }),
          } },
        { id: 'back_inside', title: 'Take {resident.him} back inside and wait', icon: 'wait', check: check(HOLD, -8), minutes: 25,
          summary: 'Not across that street tonight. {resident.first} goes back to the inside hallway with an officer, and everyone waits for the shooting to stop.',
          preview: { favorable: '{resident.first} goes back to the hallway to wait, if the oxygen allows.', mixed: '{resident.first} waits, and the wait gets hard.', adverse: '{resident.first} runs short of air, or a round comes through the front window.' },
          outcomes: {
            favorable: gauge({ text: '{resident.first} goes back to the hallway. The tank gauge is in the red.', mark: ['running_low'], next: { node: 'inside_room' }, pressure: 8 },
              { text: '{resident.first} goes back to the hallway with an officer and a flashlight.', next: { node: 'inside_room' }, objective: 8 }),
            mixed: gauge({ text: '{resident.first} goes back inside, saying {resident.he} knew this would happen. The tank gauge is in the red.', mark: ['stung', 'running_low'], next: { node: 'inside_room' } },
              { text: '{resident.first} goes back inside, saying {resident.he} knew this would happen.', mark: ['stung'], next: { node: 'inside_room' } }),
            adverse: gauge({ text: 'Back in the hallway, {resident.first} is fighting for breath. The tank is almost gone.', mark: ['running_low'], next: { node: 'inside_room' }, pressure: 14 },
              { text: 'A round comes through the front window as {resident.he} {resident~goes|go} back in. Nobody is hit.', next: { node: 'inside_room' }, pressure: 8 }),
          } },
      ] },
    { id: 'inside_room', stage: 'resolve',
      prompt: '{resident.first} is in the inside hallway with an officer. The shooter across the street is still at {shooter.his} window.',
      promptIf: [
        { when: { marks: ['tank_empty'] }, prompt: '{resident.first} is slumped forward with the empty tank across {resident.his} knees.' },
        { when: { marks: ['running_low'] }, prompt: '{resident.first} is in the hallway, breathing hard. The spare tank is nearly empty, and the street is still open to {shooter.his} window.' },
      ],
      choices: [
        { id: 'go_for_breath', title: 'Stop waiting and cross now', icon: 'door', walks: 'resident', check: check(MOVE, 6), minutes: 3, consequenceLevel: 'severe',
          modifiers: [{ label: 'The vehicle screens the door', mark: 'screened', value: 14 }],
          summary: 'You cross with {resident.first} in the chair. The street is no safer than it was, and the tank won’t last forever.',
          preview: { favorable: '{resident.first} is across and on the ambulance’s oxygen.', mixed: '{resident.first} is across, after a hard moment at the curb.', adverse: 'It goes wrong in the street, and {resident.first} can be hurt or killed.' },
          outcomes: {
            favorable: [...tankFull([{ text: 'The team runs the chair across. The medic has {resident.first} on the ambulance’s oxygen a minute later.', safe: ['resident'], next: { ending: 'out_together' }, objective: 46 }]),
              tankEmpty('The chair goes across at a run, and {resident.first} doesn’t lift {resident.his} head. The medic meets the chair in the street with a mask.', 28)],
            mixed: [...tankFull(doorway({ text: 'A round hits the street as the chair crosses. {resident.first} gets across and onto the ambulance’s oxygen.', safe: ['resident'], next: { ending: 'out_together' }, objective: 40 },
              { text: 'The chair sticks at the curb before it goes over. {resident.first} gets across and onto the ambulance’s oxygen.', safe: ['resident'], next: { ending: 'out_together' }, objective: 42 })),
              tankEmpty('A wheel drops into a pothole halfway over, and the officers lift the chair out with {resident.first} sagging in the seat. The medic takes over on the far sidewalk.', 22)],
            adverse: [
              { if: { fact: 'sees_door', is: true }, when: { notMarks: ['screened'] }, text: '{shooter.He} {shooter~fires|fire} while the chair is in the street. {resident.first} is hit, and dies behind the patrol cars with the medic working on {resident.him}.', reveal: ['sees_door'], harm: { resident: 'fatal' }, next: { ending: 'resident_killed' }, objective: 5 },
              { if: { fact: 'sees_door', is: true }, when: { marks: ['screened'] }, text: 'A round comes over the vehicle and hits {resident.first} in the shoulder. The medic gets {resident.him} onto oxygen behind the cars.', reveal: ['sees_door'], safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 16 },
              { if: { fact: 'sees_door', is: false }, text: 'The chair tips at the curb. {resident.first} falls and is hurt, and the medic gets {resident.him} onto oxygen in the street.', reveal: ['sees_door'], safe: ['resident'], harm: { resident: 'wounded' }, next: { ending: 'resident_hurt' }, objective: 22 },
            ],
          } },
        { id: 'all_night', title: 'Wait for the shooting to stop', icon: 'wait', check: check(HOLD, -10), minutes: 60, span: 'All night',
          summary: 'Everyone stays where they are until the shooting across the street stops. {resident.first} stays in the hallway for as long as that takes.',
          preview: { favorable: 'The shooting ends, and {resident.first} goes out on a quiet street, if the tank has lasted.', mixed: 'The shooting ends near dawn. If the tank is low, it runs out first.', adverse: 'If the tank runs out first, {resident.first} can die in the hallway.' },
          outcomes: {
            favorable: empty({ text: 'The shooting stops after forty minutes, with the tank already empty. {resident.first} goes out in the chair, gray and gasping, and the medic has {resident.him}.', safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 20 },
              { text: 'The shooting stops after forty minutes. {resident.first} rolls out in {resident.his} own chair onto a quiet street.', safe: ['resident'], next: { ending: 'slow_out' }, objective: 44 }),
            mixed: empty({ text: 'The shooting stops near dawn. The tank ran out hours before. {resident.first} is barely conscious when the medic reaches {resident.him}.', safe: ['resident'], harm: { resident: 'serious' }, next: { ending: 'resident_hurt' }, objective: 14, minutes: 40 },
              { text: 'The shooting stops near dawn. {resident.first} rolls out in the chair, exhausted.', safe: ['resident'], next: { ending: 'slow_out' }, objective: 38, minutes: 40 }),
            adverse: empty({ text: 'An hour in, nothing is left in the tank. {resident.first} dies in the hallway, with the officer beside {resident.him}.', harm: { resident: 'fatal' }, next: { ending: 'tank_ran_out' }, objective: 5 },
              { text: 'The shooting hasn’t stopped by the end of the shift. {resident.first} is still in the hallway with an officer.', next: { ending: 'still_inside' } }),
          } },
      ] },
  ],
  endings: {
    out_together: { title: 'Out, chair and all', disposition: 'resolved',
      summary: '{resident.first} is safe behind the patrol cars, in {resident.his} own chair. Patrol still holds the house across the street. {neighbor.first} is holding {resident.first}’s bag.' },
    slow_out: { title: 'Out once it was quiet', disposition: 'resolved',
      summary: '{resident.first} rolled out in {resident.his} own chair once the street was quiet. {resident.He} waited it out in {resident.his} hallway with an officer and a flashlight.' },
    out_carried: { title: 'Out, carried', disposition: 'resolved',
      summary: '{resident.first} is safe across the street, and the chair came after {resident.him}. {resident.He} {resident~hasn’t|haven’t} said a word to the officers who carried {resident.him}.' },
    out_without_chair: { title: 'Out without the chair', disposition: 'resolved', remainingTasks: ['Bring {resident.first}’s chair out of the house'],
      summary: '{resident.first} is safe across the street, carried. {resident.His} chair is still in the front room, and {resident.he} {resident~asks|ask} about it every few minutes.' },
    resident_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{resident.first} is with the medic, hurt, and out of the house. Patrol still holds the house across the street. {neighbor.first} rides in the ambulance with {resident.him}.' },
    resident_killed: { title: '{resident.first} died crossing', disposition: 'relief_partial',
      summary: '{resident.first} died in front of {resident.his} own house. {neighbor.first} is sitting on the curb with {resident.his} bag in {neighbor.his} lap. Patrol still holds the house across the street.' },
    tank_ran_out: { title: 'The tank ran out', disposition: 'relief_partial',
      summary: '{resident.first} died in {resident.his} hallway when the tank ran out, with an officer beside {resident.him}. {neighbor.first} is sitting on the curb with {resident.his} bag in {neighbor.his} lap. Patrol still holds the house across the street.' },
    still_inside: { title: 'Still in the hallway', disposition: 'relief_partial', remainingTasks: ['Get {resident.first} out once the street is safe'],
      summary: '{resident.first} is still in {resident.his} hallway with an officer at the end of the shift. Patrol still holds the house across the street.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get {resident.first} out safely'],
      summary: 'Command still holds the street, and the call is still open. The team has no step left that it can take from here.' },
  },
  rewards: { funding: 2900, devPoints: 4, trust: 7, xp: 50 },
  squads: { min: 1, max: 3 },
};
