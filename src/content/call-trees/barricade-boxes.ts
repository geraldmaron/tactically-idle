import type { CallTree, TreeChoice, TreeIf, TreeOutcome } from './types';

// Everything Goes Back (docs/calls/barricade-design.md). Moving day at a family house the late
// owner's child came home to find sold. The child has the parent's hunting piece and is carrying
// the boxes back in, room by room, toward the bedroom where a mover is hiding in the closet. Hidden
// truth: whether the subject knows the mover is there (knows_mover), and whether the subject walks
// out once the list of the parent's things is taken down (comes_out). The boxes clock moves the
// subject to the mover's door, and running out opens it (found).
//
// The building decides the call: the mover's room can be upstairs (R-B1), it may have a window to
// climb out of (R-B2), and the hall the subject keeps walking is the first room on the mover's way
// out (R-B3), which the team can watch or enter. Phone calls and holds move nobody.
//
// Self-harm screen (E4): applies. A parent's death this year, the family house sold without them,
// the parent's hunting piece, and a refusal. No path shows the subject's death (noDeathOnCard, force
// noFatal). Content note and 988 debrief line drafted in the design sheet, pending O2 and R5.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const QUIET = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.5 }, { key: 'awareness', weight: 0.5 }] } as const;
const LOOK = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'composure', weight: 0.3 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
type Base = typeof TALK | typeof HOLD | typeof QUIET | typeof LOOK | typeof MOVE | typeof ENTER;
const check = (base: Base, difficulty = 0): TreeChoice['check'] => ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

const KNOWS: TreeIf = { fact: 'knows_mover', is: true };
const UNAWARE: TreeIf = { fact: 'knows_mover', is: false };
const COMES: TreeIf = { fact: 'comes_out', is: true };
const STAYS: TreeIf = { fact: 'comes_out', is: false };
const BREAKING: TreeIf = { meter: 'subject', stance: 'breaking' };
const HOLDING: TreeIf = { meter: 'subject', stance: 'breaking', is: false };
const BOXES_OUT: TreeIf = { clock: 'boxes', out: true };
const BOXES_OK: TreeIf = { clock: 'boxes', out: false };

/** The first room past the mover's own on the way out: the hall the subject keeps walking. */
const HALL = { route: 'mover', step: 1, is: 'hall' } as const;
const AT_DOOR = { doorOf: 'mover' } as const;

/** An adverse result that brings the subject toward the mover. `lead` either way; if the subject
 * knows the mover is there, the weapon comes up at the door (the threat to life that lets
 * command approve going in); if not, at breaking point the subject goes into that room anyway and
 * finds the closet; otherwise the subject goes back to the boxes. */
function escalate(opts: { lead: string; threat: string; finds: string; quiet: string; quietNext?: TreeOutcome['next']; quietHeld?: string; extra?: Partial<TreeOutcome> }): TreeOutcome[] {
  const { lead, threat, finds, quiet, quietNext = { node: 'standoff' }, quietHeld, extra = {} } = opts;
  // A quiet branch that ends the call held: in the closet unseen, or in the room once found.
  const quietOut: TreeOutcome[] = quietHeld === undefined
    ? [{ if: [UNAWARE, HOLDING], text: quiet, reveal: ['knows_mover'], next: quietNext }]
    : [{ if: [UNAWARE, HOLDING], when: { notMarks: ['found'] }, text: quiet, reveal: ['knows_mover'], next: { ending: 'held_with_mover' } },
      { if: [UNAWARE, HOLDING], when: { marks: ['found'] }, text: quietHeld, reveal: ['knows_mover'], next: { ending: 'held_found' } }];
  return [
    { ...extra, text: lead },
    { if: KNOWS, text: threat, reveal: ['knows_mover'], mark: ['at_the_door'], moveTo: { subject: { to: AT_DOOR, seen: true } }, next: { node: 'threat' } },
    { if: [UNAWARE, BREAKING], text: finds, moveTo: { subject: { to: { room: 'mover' }, seen: true } }, next: { node: 'found' } },
    ...quietOut,
  ];
}

/** The call ends with the mover still inside: in the closet unseen, or in the room with the
 * subject once they have been found (`found`). `also` are the band's conditions on the held branch. */
const heldEnd = (lead: TreeOutcome, foundLine: string, also: TreeIf[] = []): TreeOutcome[] => {
  const cond = also.length ? { if: also } : {};
  return [
    lead,
    { ...cond, when: { marks: ['found'] }, text: foundLine, next: { ending: 'held_found' } },
    { ...cond, when: { notMarks: ['found'] }, text: '', next: { ending: 'held_with_mover' } },
  ];
};

/** The subject walks out to the team after the list. */
const walksOut: Pick<TreeOutcome, 'out'> = { out: ['subject'] };

/** Going in for the mover: the same move from three places, each with its own lines. */
type GoInText = { summary: string; preview: Record<'favorable' | 'mixed' | 'adverse', string>; clean: string; hurt: string; trip: string; swing: string };
const goIn = (id: string, difficulty: number, to: 'door' | 'room', t: GoInText): TreeChoice => ({ id, title: 'Send officers in', icon: 'shield',
  team: to === 'door' ? { to: AT_DOOR, entry: 'subject' } : { to: { room: 'mover' }, entry: 'subject' },
  check: check(ENTER, difficulty), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
  requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
  summary: t.summary, preview: t.preview,
  outcomes: {
    favorable: [{ text: t.clean, safe: ['mover'], out: ['subject'], next: { ending: 'entry_clean' }, objective: 50 }],
    mixed: [{ text: t.hurt, safe: ['mover'], harm: { subject: 'serious' }, out: ['subject'], next: { ending: 'entry_subject_hurt' }, objective: 36 }],
    adverse: [
      { if: COMES, text: t.trip, officer: 'wounded', safe: ['mover'], harm: { mover: 'wounded' }, out: ['subject'], next: { ending: 'entry_mover_hurt' }, objective: 24, civilian: -15 },
      { if: STAYS, text: t.swing, safe: ['mover'], force: { on: 'subject', next: { hurt: { ending: 'subject_hurt_force' }, none: { ending: 'entry_clean' } }, noFatal: true }, objective: 20 },
    ],
  } });

export const BARRICADE_BOXES: CallTree = {
  type: 'barricaded',
  title: 'Everything Goes Back',
  roles: [
    { id: 'subject', label: 'the late owner’s {subject^son|daughter|child}', pronouns: 'he', kind: 'subject', surnameGroup: 'family',
      carries: { label: 'Long weapon', glyph: 'weapon', knownFrom: 'weapon' } },
    { id: 'mover', label: 'mover', pronouns: 'they', kind: 'civilian', place: { rooms: ['bedroom'], floor: 'any' } },
    { id: 'sibling', label: '{subject.his} {sibling^brother|sister|sibling}', pronouns: 'she', kind: 'bystander', surnameGroup: 'family' },
  ],
  families: ['cedar_close', 'harbour_court', 'willow_terrace_v1', 'ash_grove_v1', 'juniper_court_v1', 'bungalow_g2', 'two_storey_house_g2', 'semi_detached_g2', 'apartment_unit_g2'],
  scene: { setting: ['residential', 'apartment'], rooms: ['living', 'kitchen'], timeOfDay: 'dusk', crowd: 1 },
  summary: '{mover.first} went back in for the last box. Now the late owner’s {subject^son|daughter|child} is armed inside and says nothing else leaves.',
  pressureLabel: '{mover.first} in the closet',
  pressure: { start: 20, perMinute: 0.25, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: 'The crew’s driver called 911 when {subject} bolted the door and said the next one through would regret it. {mover.first} never came out.',
    known: [
      '{mover.first} texted the driver, “In the closet. Someone keeps walking past.”',
      'Patrol saw {subject.first} at the front window with a long weapon.',
      'Every way out of {mover.first}’s room runs through the hall {subject.first} keeps walking.',
    ],
    unknown: ['Does {subject.first} know {mover.first} is hiding in there?'],
    responsibilities: ['Get {mover.first} out of the closet', 'Bring {subject.first} out alive'],
  },
  stageLabels: { assess: 'Moving day', adapt: 'The boxes', resolve: 'Last room' },
  objectives: [
    { id: 'mover', label: 'See {mover.first} safe outside' },
    { id: 'subject', label: 'Have {subject.first} walk out unhurt' },
  ],
  // The weapon raised at the door the mover is behind, or fired at the team: threats to
  // life the team has seen (sim/authorization.ts). Seen at the front window, it is why the team is
  // here, not a reason to go in.
  threatMarks: {
    at_the_door: '{subject.first} raised the weapon at the door {mover.first} is behind',
    shot_at: '{subject.first} fired at the team',
    aimed_in_room: '{subject.first} aimed the weapon at {mover.first} in the bedroom',
  },
  facts: {
    weapon: { public: true, truth: true, source: 'Responding patrol', label: 'Patrol’s weapon report',
      claim: 'Patrol says {subject.first} is holding a long weapon.',
      confirmed: 'The team saw the weapon within {subject.first}’s reach.', disproved: 'The team could not see the weapon.' },
    knows_mover: { label: 'What {subject.first} knows', claim: 'Whether {subject.first} knows {mover.first} is in the house.',
      confirmed: '{subject.first} has known about the closet all along.', disproved: '{subject.first} didn’t know {mover.first} was in the house.' },
    comes_out: { label: '{subject.first}’s terms', claim: 'Whether {subject.first} will come out once the list is taken down.',
      confirmed: '{subject.first} says a written list is enough to bring {subject.him} out.', disproved: '{subject.first} says {subject.he} {subject~stays|stay} in the house, list or no list.' },
  },
  situations: [
    { note: '{subject.He} {subject~thinks|think} the movers all left and {subject~wants|want} the list kept. Taken down, it brings {subject.him} out.', truth: { knows_mover: false, comes_out: true } },
    { note: '{subject.He} {subject~knows|know} the mover is in the closet and lets them be. The list still brings {subject.him} out.', truth: { knows_mover: true, comes_out: true } },
    { note: '{subject.He} {subject~knows|know} the mover is there and won’t leave the house, list or no list. Pressed, {subject.he} {subject~goes|go} to that door.', truth: { knows_mover: true, comes_out: false } },
  ],
  turns: { inside: ['turn_list', 'turn_hall', 'turn_text'] },
  difficulty: { base: 40, perTier: 4 },
  root: 'porch',
  nodes: [
    // ------------------------------------------------------------------ stage 1: approach
    { id: 'porch', stage: 'assess',
      prompt: 'Boxes are going back in past the front window, and {mover.first} has stopped texting.',
      promptIf: [{ when: { upstairs: ['mover'] }, prompt: '{mover.first}’s last text came from a closet upstairs, and the boxes downstairs keep moving room to room.' }],
      choices: [
        { id: 'call', title: 'Call the house phone', icon: 'radio', talksTo: 'subject', check: check(TALK), minutes: 3,
          summary: '{lead} dials the landline by the front window. {subject.first} can let the ringing go and keep carrying boxes.',
          preview: { favorable: '{subject.first} picks up and stays at the front of the house.', mixed: '{subject.first} answers, then hangs up mid-sentence.', adverse: 'Nobody answers, and {subject.first} carries the next box toward the back.' },
          outcomes: {
            favorable: [{ text: '{subject.first} answers on the fourth ring. The movers get their truck back when the house is put right, {subject.he} {subject~says|say}.', moves: { subject: 'contact' }, next: { node: 'on_the_line' }, objective: 12 }],
            mixed: [{ text: '“Nothing else leaves,” {subject.first} says, and the line goes dead.', moves: { subject: 'provoked' }, next: { turn: 'inside' }, objective: 6 }],
            adverse: [{ text: 'The landline rings eleven times with no answer. A box passes the front window, headed down the hall.', moveTo: { subject: HALL }, next: { turn: 'inside' }, pressure: 6 }],
          } },
        { id: 'glass', title: 'Watch through the glass', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'subject' } }, check: check(LOOK), minutes: 4, consequenceLevel: 'moderate',
          summary: '{lead} sets up at the glass, in plain sight of {subject.first} and the weapon.',
          preview: { favorable: 'You see where {subject.first} stands and what {subject.he} {subject~is|are} holding.', mixed: 'You get a look, and {subject.first} sees you too.', adverse: '{subject.first} spots you and may fire through the glass.' },
          outcomes: {
            favorable: [{ text: 'The team watches {subject.first} stack boxes by the sofa. The weapon leans against the wall beside {subject.him}.', mark: ['room_seen'], next: { turn: 'inside' }, objective: 10 }],
            mixed: [{ text: '{subject.first} glances up, sees the squad and drags the curtain shut.', mark: ['seen_glass'], moves: { subject: 'team_seen' }, next: { turn: 'inside' }, objective: 6 }],
            adverse: [
              { text: '{subject.first} looks straight at the squad by the glass.', moves: { subject: ['team_seen', 'provoked'] } },
              { if: BREAKING, text: 'A shot goes through the top pane, and the officers drop below the sill.', fire: { from: 'subject' }, mark: ['shot_at'], next: { node: 'fired_on' }, pressure: 10 },
              { if: HOLDING, text: 'The curtain comes across. Boxes start moving toward the back of the house.', mark: ['seen_glass'], moveTo: { subject: HALL }, back: true, next: { turn: 'inside' }, pressure: 6 },
            ],
          } },
        { id: 'back_step', title: 'Go round to {mover.first}’s window', icon: 'perimeter', team: { to: { vantage: 'mover' }, signal: { channel: 'voice', to: 'mover' } }, check: check(QUIET), minutes: 4, consequenceLevel: 'moderate',
          onlyIf: { notUpstairs: ['mover'] },
          summary: '{lead} creeps up the gravel side path to whisper through the glass. Nobody watches the front while you’re there.',
          preview: { favorable: '{mover.first} hears your voice and stays put in the closet.', mixed: '{mover.first} answers too loudly for the quiet house.', adverse: 'The gravel crunches, and {subject.first} may come looking with the weapon.' },
          outcomes: {
            favorable: [{ text: '{mover.first} taps twice on the inside of the closet door. The house stays quiet.', mark: ['mover_steady', 'at_back'], next: { turn: 'inside' }, objective: 10 }],
            mixed: [{ text: '“Are you police?” {mover.first} whispers, too loud. The boxes inside keep moving.', mark: ['mover_steady', 'at_back'], next: { turn: 'inside' }, objective: 6 }],
            adverse: escalate({
              lead: 'Gravel crunches under the window. The footsteps in the hall stop.',
              threat: '{subject.first} is outside {mover.first}’s door now, the weapon up at {subject.his} shoulder.',
              finds: '{subject.first} walks into that room to find the noise and pulls the closet open.',
              quiet: '{subject.first} checks the back window, sees no one and picks up another box.',
              quietNext: { turn: 'inside' },
              extra: { moves: { subject: 'provoked' }, pressure: 6 } }),
          } },
        { id: 'back_step_up', title: 'Call up to {mover.first}’s window', icon: 'perimeter', team: { to: { vantage: 'mover' }, signal: { channel: 'voice', to: 'mover' } }, check: check(QUIET, 4), minutes: 4, consequenceLevel: 'moderate',
          onlyIf: { upstairs: ['mover'] },
          summary: '{lead} stands in the open backyard and calls up softly. If {mover.first} answers loudly, the whole house hears.',
          preview: { favorable: '{mover.first} learns you are under the window.', mixed: '{mover.first} calls back, loud enough to reach the landing.', adverse: 'Your voice carries, and {subject.first} may climb the stairs with the weapon.' },
          outcomes: {
            favorable: [{ text: '{mover.first} waves once through the window, then ducks back into the closet.', mark: ['mover_steady'], next: { turn: 'inside' }, objective: 10 }],
            mixed: [{ text: '“Is that the police?” {mover.first} calls down, too loud. Nobody comes up the stairs.', mark: ['mover_steady'], next: { turn: 'inside' }, objective: 6 }],
            adverse: escalate({
              lead: 'The call carries through the house, and the thump of boxes downstairs stops.',
              threat: '{subject.first} is on the landing, the weapon aimed at {mover.first}’s door.',
              finds: '{subject.first} climbs the stairs toward the voice and pulls open the closet on {mover.first}.',
              quiet: '{subject.first} stands on the landing a moment, then goes downstairs to the next box.',
              quietNext: { turn: 'inside' },
              extra: { moves: { subject: 'provoked' }, pressure: 6 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the boxes
    { id: 'on_the_line', stage: 'adapt',
      prompt: '{subject.first} answers with a box under one arm. {subject.He} {subject~wants|want} the movers gone and the house left alone.',
      choices: [
        { id: 'sale_stands', title: 'Tell {subject.him} the sale stands', icon: 'radio', talksTo: 'subject', check: check(TALK, 3), minutes: 3,
          summary: '{lead} says the house is sold and nobody here can undo that. {subject.first} hears that from a stranger, on the parent’s phone.',
          preview: { favorable: '{subject.first} goes silent, then asks you a question.', mixed: '{subject.first} swears at you and stays on the line.', adverse: '{subject.first} slams the phone down and may take the weapon to {mover.first}’s door.' },
          outcomes: {
            favorable: [{ text: '{subject.first} is quiet for a while. Then {subject.he} {subject~asks|ask} whether {sibling.first} is out there.', moves: { subject: 'honest' }, next: { node: 'talking' }, objective: 12, pressure: -4 }],
            mixed: [{ text: '{subject.first} swears at the team for a minute and doesn’t hang up.', moves: { subject: ['honest', 'provoked'] }, next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: '{subject.first} slams the receiver down.',
              threat: 'An officer at the side window watches {subject.first} stop at {mover.first}’s door and lift the weapon.',
              finds: '{subject.first} puts things back one bedroom at a time and reaches the closet with {mover.first} inside.',
              quiet: '{subject.first} picks up again on the third call without a word.',
              quietNext: { node: 'talking' },
              extra: { moves: { subject: 'provoked' }, pressure: 6 } }),
          } },
        { id: 'who_else', title: 'Ask who else is inside', icon: 'intel', talksTo: 'subject', check: check(TALK, 2), minutes: 3,
          summary: '{lead} asks plainly whether the movers all got out. If {subject.first} didn’t know about {mover.first}, now {subject.he} {subject~does|do}.',
          preview: { favorable: 'You learn whether {subject.first} knows, and {subject.he} {subject~keeps|keep} talking.', mixed: 'You get an answer, and {subject.first} puts the phone down to check.', adverse: '{subject.first} takes the weapon and goes looking for whoever is in there.' },
          outcomes: {
            favorable: [
              { if: KNOWS, text: '“The kid in the closet can stay there,” {subject.first} says. “Nobody’s carrying anything out.”', reveal: ['knows_mover'], mark: ['knows_said'], next: { node: 'talking' }, objective: 12 },
              { if: UNAWARE, text: '“Everybody left,” {subject.first} says. “I watched the truck.”', reveal: ['knows_mover'], next: { node: 'talking' }, objective: 10 },
            ],
            mixed: [
              { if: KNOWS, text: '{subject.first} says the mover can stay put, then leaves the receiver on the table and heads for the bedrooms.', reveal: ['knows_mover'], mark: ['knows_said'], moveTo: { subject: AT_DOOR }, next: { node: 'talking' }, objective: 6 },
              { if: UNAWARE, text: '{subject.first} stops talking. Footsteps start down the hall, door after door.', reveal: ['knows_mover'], moveTo: { subject: HALL }, next: { node: 'talking' }, objective: 4 },
            ],
            adverse: [
              { if: KNOWS, text: '{subject.first} drops the phone. Seconds later the weapon is up and pointed at {mover.first}’s door.', reveal: ['knows_mover'], mark: ['at_the_door'], moveTo: { subject: { to: AT_DOOR, seen: true } }, moves: { subject: 'provoked' }, next: { node: 'threat' } },
              { if: UNAWARE, text: '{subject.first} grabs the weapon and searches every room until {subject.he} {subject~finds|find} the closet.', reveal: ['knows_mover'], moveTo: { subject: { to: { room: 'mover' }, seen: true } }, moves: { subject: 'provoked' }, next: { node: 'found' } },
            ],
          } },
        { id: 'let_talk', title: 'Let {subject.him} talk about home', icon: 'wait', talksTo: 'subject', check: check(HOLD, -6), minutes: 12,
          summary: 'You let {subject.first} go on about the house as long as {subject.he} {subject~wants|want}. {mover.first} sits in the closet through all of it.',
          preview: { favorable: 'The boxes stay put while {subject.first} talks.', mixed: '{subject.first} talks for a bit, then picks up a box again.', adverse: '{subject.first} talks in circles while the boxes creep toward {mover.first}’s room.' },
          outcomes: {
            favorable: [{ text: '{subject.first} talks about the kitchen table and the pencil marks on a doorframe, the last at fourteen. No box moves.', moves: { subject: 'heard' }, next: { node: 'talking' }, objective: 12, pressure: -4 }],
            mixed: [{ text: '{subject.first} talks until the cord won’t reach, then sets the receiver down to carry.', moves: { subject: 'heard' }, moveTo: { subject: HALL }, next: { node: 'talking' }, objective: 6 }],
            adverse: [
              { if: BOXES_OK, text: '{subject.first} goes around and around the sale while the boxes travel down the hall.', moveTo: { subject: HALL }, next: { node: 'talking' } },
              { if: BOXES_OUT, text: '{subject.first} stops talking halfway through a sentence. The receiver hangs off the table.', next: { node: 'found' } },
            ],
          } },
      ] },

    { id: 'turn_list', stage: 'adapt',
      prompt: '{sibling.first} says {subject.first} listed what to keep on a box flap and threw the flap off the porch.',
      choices: [
        { id: 'flap', title: 'Fetch the box flap', icon: 'search', team: { to: { vantage: 'scene' } }, check: check(QUIET), minutes: 5, consequenceLevel: 'moderate',
          summary: '{lead} crawls to the porch steps for the flap, in sight of the front window the whole way.',
          preview: { favorable: 'You have the whole list, and {subject.first} never sees you.', mixed: 'You get the flap back, but {subject.first} spots you on the steps.', adverse: '{subject.first} catches you on the porch and may fire.' },
          outcomes: {
            favorable: [{ text: 'The flap says, in marker, “The chair. The clock. The height marks.” Nobody inside looks out.', mark: ['has_list'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: 'The team gets back with the list, and {subject.first} shouts after them from the porch.', mark: ['has_list'], moves: { subject: 'team_seen' }, next: { node: 'talking' }, objective: 6 }],
            adverse: [
              { text: '{subject.first} is at the window before the team reaches the steps.', moves: { subject: ['team_seen', 'provoked'] } },
              { if: BREAKING, text: 'A shot hits the porch rail, and the team pulls back behind the truck.', fire: { from: 'subject' }, mark: ['shot_at'], back: true, next: { node: 'fired_on' }, pressure: 10 },
              { if: HOLDING, text: 'The team backs away from the house without the flap.', back: true, next: { node: 'talking' }, pressure: 6 },
            ],
          } },
        { id: 'ask_list', title: 'Ask what the list says', icon: 'radio', talksTo: 'subject', check: check(TALK), minutes: 3,
          summary: '{lead} asks on the phone what {subject.first} wants kept. Every item {subject.first} names is something already sold.',
          preview: { favorable: '{subject.first} reads you every line of the list.', mixed: '{subject.first} starts the list and stops at the sale.', adverse: 'The question sets {subject.first} off, and {subject.he} may carry the weapon toward {mover.first}’s room.' },
          outcomes: {
            favorable: [{ text: '{subject.first} reads out the clock, the armchair and the marks on the doorframe. {subject.His} voice slows down.', mark: ['list_told'], moves: { subject: 'heard' }, next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{subject.first} names the chair and the clock, then says it doesn’t matter because it’s all sold.', moves: { subject: 'provoked' }, next: { node: 'talking' }, objective: 4 }],
            adverse: escalate({
              lead: '“You don’t get the list,” {subject.first} says before the line clicks off.',
              threat: '{subject.first} walks to {mover.first}’s door and holds the weapon level at the handle.',
              finds: '{subject.first} carries a box into that bedroom and opens the closet to put it away.',
              quiet: '{subject.first} answers the next call and stays silent.',
              quietNext: { node: 'talking' },
              extra: { moves: { subject: 'provoked' }, pressure: 6 } }),
          } },
      ] },

    { id: 'turn_hall', stage: 'adapt',
      prompt: 'The side window shows the hall. Each time {subject.first} passes {mover.first}’s door, {subject.he} {subject~stops|stop}.',
      promptIf: [{ when: { upstairs: ['mover'] }, prompt: 'You can see the landing through a window. {subject.first} keeps carrying boxes up past {mover.first}’s door.' }],
      choices: [
        { id: 'watch', title: 'Watch the hall', icon: 'search', team: { to: { watch: HALL }, signal: { channel: 'visual', to: 'subject' } }, check: check(LOOK), minutes: 6, consequenceLevel: 'moderate',
          summary: '{lead} holds the side window and times every pass {subject.first} makes. If {subject.first} glances out, your officers are right there.',
          preview: { favorable: 'You know where {subject.first} is and when {subject.he} {subject~passes|pass}.', mixed: 'You learn the timing, and {subject.first} glimpses you.', adverse: '{subject.first} catches sight of you and plants {subject.himself} in the hall.' },
          outcomes: {
            favorable: [{ text: 'The team clocks a pass every four minutes, a stop at the door, then a walk up to the sofa.', mark: ['hall_watched'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: 'The team gets the timing, but {subject.first} glances at the window on the last pass.', mark: ['hall_watched'], moves: { subject: 'team_seen' }, next: { node: 'talking' }, objective: 6 }],
            adverse: [{ text: '{subject.first} sees the officers and stops in the hall, staring out at them.', moves: { subject: ['team_seen', 'provoked'] }, moveTo: { subject: { to: HALL, seen: true } }, back: true, next: { node: 'talking' }, pressure: 6 }],
          } },
        { id: 'time_call', title: 'Call on every pass', icon: 'radio', talksTo: 'subject', check: check(TALK), minutes: 2,
          summary: '{lead} rings the landline whenever {subject.first} stops at {mover.first}’s door. If the ringing is ignored, {subject.first} stays at that door.',
          preview: { favorable: '{subject.first} comes back up front whenever the landline rings.', mixed: '{subject.first} comes to the first ring and ignores the rest.', adverse: '{subject.first} lets the landline ring and stays close to {mover.first}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} walks up front to answer on every pass, and the stops at the door get shorter.', mark: ['hall_timed'], moveTo: { subject: 'scene' }, next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{subject.first} picks up once, then leaves the landline ringing.', next: { node: 'talking' }, objective: 4 }],
            adverse: [{ text: '{subject.first} doesn’t move from {mover.first}’s door while the phone rings on.', moveTo: { subject: AT_DOOR }, next: { node: 'talking' }, minutes: 4 }],
          } },
      ] },

    { id: 'turn_text', stage: 'adapt',
      prompt: '{mover.first} texts the driver that the phone battery is going and asks whether to run for the back door.',
      promptIf: [{ when: { upstairs: ['mover'] }, prompt: 'A message from upstairs says {mover.first}’s battery is at two percent. {mover.first} wants to risk the stairs.' }],
      choices: [
        { id: 'stay', title: 'Tell {mover.first} to stay put', icon: 'search', check: check(QUIET, -4), minutes: 1,
          summary: '{lead} texts {mover.first} to sit tight and mute the phone. If the battery dies, you lose your only line to {mover.him}.',
          preview: { favorable: '{mover.first} answers and stays quiet.', mixed: '{mover.first} replies once, and the battery dies.', adverse: 'Your text buzzes through the closet door, and the weapon could follow the sound.' },
          outcomes: {
            favorable: [{ text: '{mover.first} texts back “ok” and goes silent.', mark: ['mover_steady'], next: { node: 'talking' }, objective: 8 }],
            mixed: [{ text: '{mover.first} sends “ok,” and then the screen on that end goes dark.', mark: ['mover_steady', 'mover_dark'], next: { node: 'talking' }, objective: 4 }],
            adverse: escalate({
              lead: 'The phone buzzes before {mover.first} can mute it.',
              threat: '{subject.first} follows the buzz down the hall and raises the weapon at {mover.first}’s door.',
              finds: '{subject.first} tracks the sound to the closet and yanks it open.',
              quiet: 'The buzzing stops. {subject.first} keeps stacking boxes up front.',
              quietNext: { node: 'talking' },
              extra: { mark: ['mover_dark'], pressure: 6 } }),
          } },
        { id: 'window_talk', title: 'Coach {mover.first} at the window', icon: 'perimeter', team: { to: { vantage: 'mover' }, signal: { channel: 'voice', to: 'mover' } }, check: check(QUIET), minutes: 4, consequenceLevel: 'moderate',
          onlyIf: { notUpstairs: ['mover'] },
          summary: '{lead} goes to {mover.first}’s window to keep {mover.him} still. Your squad ends up at the back, where any voice carries.',
          preview: { favorable: '{mover.first} settles, and your squad is set behind the house.', mixed: '{mover.first} answers you, a bit too loud for the hall.', adverse: 'The voices may bring {subject.first}, armed, down the hall to that door.' },
          outcomes: {
            favorable: [{ text: '{mover.first} whispers back that {mover.he} will wait for the team’s word.', mark: ['mover_steady', 'at_back'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{mover.first} replies a little too loud. Nothing moves in the hall.', mark: ['mover_steady', 'at_back'], next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: '{mover.first}’s answer reaches the hall.',
              threat: '{subject.first} turns up in the hall, the weapon trained on {mover.first}’s door.',
              finds: '{subject.first} hears the voice and finds {mover.first} behind the coats in the bedroom closet.',
              quiet: '{subject.first} pauses in the hall to listen, then carries on stacking.',
              quietNext: { node: 'talking' },
              extra: { moves: { subject: 'provoked' }, pressure: 6 } }),
          } },
        { id: 'window_talk_up', title: 'Coach {mover.first} from the yard', icon: 'perimeter', team: { to: { vantage: 'mover' }, signal: { channel: 'voice', to: 'mover' } }, check: check(QUIET, 4), minutes: 4, consequenceLevel: 'moderate',
          onlyIf: { upstairs: ['mover'] },
          summary: '{lead} murmurs instructions to the upstairs window. Sound from outside carries up the stairwell too.',
          preview: { favorable: '{mover.first} settles and stays put upstairs.', mixed: '{mover.first} answers from the window, loud enough for the landing.', adverse: 'Your voice could draw {subject.first} up the stairs, armed.' },
          outcomes: {
            favorable: [{ text: '{mover.first} cracks the window an inch and nods down at the team.', mark: ['mover_steady'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{mover.first} calls down a reply. Nobody climbs the stairs.', mark: ['mover_steady'], next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: 'The reply drifts down the stairwell.',
              threat: '{subject.first} stops at the top of the stairs, the weapon steady on the upstairs door.',
              finds: '{subject.first} follows the voice upstairs and pulls {mover.first} out from the clothes.',
              quiet: '{subject.first} stands at the foot of the stairs a while, then goes back to the boxes.',
              quietNext: { node: 'talking' },
              extra: { moves: { subject: 'provoked' }, pressure: 6 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3: the last room
    { id: 'talking', stage: 'resolve',
      prompt: 'The landline is open again. The closet door down the hall stays shut, and {mover.first} is still behind it.',
      promptIf: [
        { when: { marks: ['in_hall'] }, prompt: '{subject.first} has been stacking boxes by {mover.first}’s door. {mover.first} hasn’t moved.' },
        { when: { marks: ['knows_said'] }, prompt: '{subject.first} has told you {subject.he} {subject~knows|know} someone is in the closet. {mover.first} hasn’t made a sound.' },
        { when: { marks: ['seen_glass'] }, prompt: '{subject.first} saw you at the glass and drew the curtain. {mover.first} waits behind the closet door.' },
      ],
      choices: [
        { id: 'take_list', title: 'Take down the list', icon: 'handover', talksTo: 'subject', check: check(TALK), minutes: 8, authority: { concede: 'statement' },
          modifiers: [{ label: 'The flap from the porch', mark: 'has_list', value: 8 }, { label: '{subject.first} read the list out', mark: 'list_told', value: 4 }],
          summary: '{lead} writes down each thing {subject.first} names, for {sibling.first}. A written list undoes nothing about the sale.',
          preview: { favorable: 'The list is down, and {subject.first} decides what happens next.', mixed: 'The list goes down on paper, and {subject.first} stays inside.', adverse: '{subject.first} hears the sale in every line and may go to {mover.first}’s door armed.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} listens to the list read back, puts the weapon on the stairs and walks out the front with {subject.his} hands empty. Two officers fetch {mover.first} from the bedroom behind {subject.him}.', reveal: ['comes_out'], ...walksOut, safe: ['mover'], promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'everyone_out' }, objective: 50 },
              { if: STAYS, text: '{subject.first} hears the items twice, then opens the front door for {mover.first}. {subject.He} {subject~stays|stay} inside.', reveal: ['comes_out'], safe: ['mover'], promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { node: 'release' }, objective: 20 },
            ],
            mixed: [{ text: '{subject.first} keeps adding things until the list runs two pages. Nobody moves.', promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { node: 'standoff' }, objective: 8 }],
            adverse: escalate({
              lead: '“A list,” {subject.first} says. “You think a list fixes it.”',
              threat: '{subject.first} drops the receiver and stands at {mover.first}’s door with the weapon up.',
              finds: '{subject.first} carries the parent’s clock back to that bedroom and comes face to face with {mover.first}.',
              quiet: '{subject.first} hangs up and starts on the boxes again.',
              extra: { moves: { subject: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'walk_out', title: 'Escort {mover.first} out', icon: 'door', walks: 'mover', team: { to: 'escort' }, check: check(MOVE, 2), minutes: 5, consequenceLevel: 'high',
          support: { at: { vantage: 'scene' }, label: 'holding the front window' },
          modifiers: [{ label: 'You saw the front room', mark: 'room_seen', value: 4 }, { label: 'The ringing keeps {subject.first} up front', mark: 'hall_timed', value: 4 },
            { label: '{mover.first} is ready to go', mark: 'mover_steady', value: 4 }, { label: 'No way to warn {mover.first}', mark: 'mover_dark', value: -4 }, { label: '{subject.first} is right outside that door', mark: 'in_hall', value: -6 }],
          summary: '{lead} takes two officers down the hall for {mover.first}. That hall is the one place {subject.first} keeps coming back to.',
          preview: { favorable: '{mover.first} comes out with your officers.', mixed: '{mover.first} is clear, but {subject.first} spots your officers leaving.', adverse: '{subject.first} walks into your officers mid-hall, and the weapon may come up.' },
          outcomes: {
            favorable: [{ text: 'The officers are in and out before {subject.first} looks up. {mover.first} is on the lawn with packing tape still around {mover.his} wrist.', safe: ['mover'], next: { node: 'release' }, objective: 30 }],
            mixed: [{ text: 'The officers get {mover.first} out, but {subject.first} catches the last one leaving the hall.', safe: ['mover'], moves: { subject: ['team_seen', 'provoked'] }, next: { node: 'release' }, objective: 24 }],
            adverse: escalate({
              lead: '{subject.first} comes round the corner into the hall with a box.',
              threat: '{subject.first} drops the box and brings the weapon to bear on the team outside {mover.first}’s door.',
              finds: '{subject.first} sees the open closet and follows {mover.first} into the bedroom with the weapon.',
              quiet: 'The officers back out of the hall. {subject.first} stands still, then carries the box past the closed door.',
              extra: { moves: { subject: ['team_seen', 'provoked'] }, back: true, pressure: 8 } }),
          } },
        { id: 'between_passes', title: 'Slip in between passes', icon: 'door', walks: 'mover', team: { to: 'escort' }, check: check(QUIET, -4), minutes: 4, consequenceLevel: 'high',
          onlyIf: { marks: ['hall_watched'] },
          modifiers: [{ label: '{mover.first} knows the plan', mark: 'mover_steady', value: 4 }, { label: '{mover.first}’s phone is dead', mark: 'mover_dark', value: -4 }],
          summary: '{lead} goes in the moment {subject.first} heads back up front. Miss the gap, and you meet {subject.first} in the hall.',
          preview: { favorable: '{mover.first} is out before {subject.first} comes back.', mixed: '{mover.first} is out, but {subject.first} turns early and sees you.', adverse: '{subject.first} turns back early, right into your officers, with the weapon in reach.' },
          outcomes: {
            favorable: [{ text: 'Officers have {mover.first} across the yard before the next box comes down the hall.', safe: ['mover'], next: { node: 'release' }, objective: 32 }],
            mixed: [{ text: '{mover.first} gets clear. {subject.first} comes back too soon and spots the last officer leaving.', safe: ['mover'], moves: { subject: ['team_seen', 'provoked'] }, next: { node: 'release' }, objective: 26 }],
            adverse: escalate({
              lead: '{subject.first} reappears early, carrying a box toward the bedroom.',
              threat: '{subject.first} lets the box fall and trains the weapon on two officers by {mover.first}’s door.',
              finds: '{subject.first} notices the closet ajar and goes in after {mover.first}.',
              quiet: 'Officers ease back out while {subject.first} is turned away.',
              extra: { moves: { subject: 'provoked' }, back: true, pressure: 8 } }),
          } },
        { id: 'out_window', title: 'Bring {mover.first} out the window', icon: 'door', walks: 'mover', walksVia: 'window', team: { to: 'escort' }, check: check(QUIET, 4), minutes: 6, consequenceLevel: 'high',
          onlyIf: { exitVia: { role: 'mover', via: 'window' }, marks: ['at_back'] },
          modifiers: [{ label: '{mover.first} is steady', mark: 'mover_steady', value: 4 }, { label: '{mover.first} can’t be reached', mark: 'mover_dark', value: -4 }],
          summary: '{lead} helps {mover.first} climb out through the bedroom window, away from the hall. An old sash can be loud.',
          preview: { favorable: '{mover.first} is out the window and on the grass.', mixed: '{mover.first} gets out, and the sash bangs as {mover.he} {mover~goes|go}.', adverse: 'The sash sticks and shrieks, and {subject.first} may arrive armed before {mover.first} is through.' },
          outcomes: {
            favorable: [{ text: 'The sash slides up without a sound. {mover.first} drops onto the grass beside the team.', safe: ['mover'], next: { node: 'release' }, objective: 30 }],
            mixed: [{ text: 'The sash slams behind {mover.first} on the way out, and the carrying inside stops.', safe: ['mover'], moves: { subject: 'provoked' }, next: { node: 'release' }, objective: 24 }],
            adverse: escalate({
              lead: 'The sash sticks halfway and shrieks when the team forces it.',
              threat: '{subject.first} is at the bedroom door, lifting the weapon, before {mover.first} is clear of the sill.',
              finds: '{subject.first} comes in and drags {mover.first} back from the sill.',
              quiet: '{mover.first} lets go of the sill and hides again. Nobody comes.',
              extra: { moves: { subject: 'provoked' }, back: true, pressure: 8 } }),
          } },
        { id: 'ask_release', title: 'Ask {subject.him} to free {mover.first}', icon: 'radio', talksTo: 'subject', check: check(TALK, -2), minutes: 3, onlyIf: { marks: ['knows_said'] },
          summary: '{lead} asks {subject.first} to let {mover.first} leave by the front door. Hearing the name could send {subject.first} to that closet.',
          preview: { favorable: '{subject.first} unbolts the door for {mover.first}.', mixed: '{subject.first} holds {mover.first} back until the list exists.', adverse: '{subject.first} heads straight for that closet, armed.' },
          outcomes: {
            favorable: [{ text: '{subject.first} slides back the front bolt and waves {mover.first} out. {mover.first} walks out holding {mover.his} phone.', safe: ['mover'], moves: { subject: 'released' }, next: { node: 'release' }, objective: 30 }],
            mixed: [{ text: '{subject.first} wants the list on paper before {mover.first} takes a step.', next: { node: 'standoff' }, objective: 6 }],
            adverse: [{ text: '{subject.first} sets the phone aside, and the weapon comes up outside {mover.first}’s door.', mark: ['at_the_door'], moveTo: { subject: { to: AT_DOOR, seen: true } }, moves: { subject: 'provoked' }, next: { node: 'threat' } }],
          } },
        { id: 'past_dark', title: 'Keep {subject.him} talking past dark', icon: 'wait', talksTo: 'subject', check: check(HOLD, -10), minutes: 40, span: 'Hours',
          summary: 'You keep {subject.first} on the phone for hours and push nothing. {mover.first} spends every one of those hours in the closet.',
          preview: { favorable: 'Hours go by, and the night may end with {mover.first} out.', mixed: 'Night falls with {subject.first} still deciding, and the boxes may reach {mover.first}’s room.', adverse: 'The boxes keep moving, and {subject.first} may reach {mover.first} first.' },
          outcomes: {
            favorable: [
              { if: [COMES, BOXES_OK], text: '{subject.first} leans the weapon against the bottom stair long after dark and comes outside. {mover.first} waits until officers knock before coming out.', reveal: ['comes_out'], ...walksOut, safe: ['mover'], next: { ending: 'out_after_dark' }, objective: 46 },
              { if: [STAYS, BOXES_OK], text: 'The streetlights come on. {subject.first} says this is home and {subject.he} {subject~stays|stay}.', reveal: ['comes_out'], next: { node: 'standoff' }, objective: 10 },
              { if: [COMES, BOXES_OUT], text: '{subject.first} opens the closet near midnight, finds {mover.first} and leads {mover.him} out the back.', reveal: ['comes_out', 'knows_mover'], safe: ['mover'], moveTo: { subject: 'scene' }, next: { node: 'release' }, objective: 30 },
              { if: [STAYS, BOXES_OUT], text: 'The last box reaches the bedroom late at night. {subject.first} finds {mover.first} there and sends {mover.him} outside.', reveal: ['comes_out', 'knows_mover'], safe: ['mover'], next: { node: 'release' }, objective: 24 },
            ],
            mixed: [
              { if: BOXES_OK, text: '{subject.first}’s answers get shorter as the evening goes on. Nobody leaves the house.', next: { node: 'standoff' }, minutes: 20 },
              { if: BOXES_OUT, text: 'The boxes reach the bedroom after dark, and {subject.first} pulls the closet door wide to make room.', moveTo: { subject: { to: { room: 'mover' }, seen: true } }, next: { node: 'found' }, minutes: 20 },
            ],
            adverse: [
              { if: BOXES_OK, text: '{subject.first} runs out of things to say and stops answering.', next: { node: 'standoff' } },
              { if: BOXES_OUT, text: 'A closet door opens in the dark house.', moveTo: { subject: { room: 'mover' } }, next: { node: 'found' } },
            ],
          } },
      ] },

    { id: 'standoff', stage: 'resolve',
      prompt: '{subject.first} keeps the weapon within reach and won’t say what comes next. {mover.first} is still in the house.',
      promptIf: [{ when: { marks: ['in_hall'] }, prompt: 'An upturned box in the hall is {subject.first}’s seat now, right outside {mover.first}’s door.' }],
      choices: [
        { id: 'walk_late', title: 'Get {mover.first} out now', icon: 'door', walks: 'mover', team: { to: 'escort' }, check: check(MOVE, 6), minutes: 5, consequenceLevel: 'high',
          modifiers: [{ label: '{mover.first} has held still', mark: 'mover_steady', value: 4 }, { label: '{subject.first} is camped in the hall', mark: 'in_hall', value: -6 }],
          summary: '{lead} leads your officers in for {mover.first} while {subject.first} sits nearby. They pass close enough to touch the weapon.',
          preview: { favorable: '{mover.first} is out, and {subject.first} watches you go.', mixed: '{mover.first} is out, and {subject.first} follows you to the door.', adverse: '{subject.first} gets up and blocks the hall, armed.' },
          outcomes: {
            favorable: [{ text: '{subject.first} doesn’t get up from the boxes as the team walks {mover.first} past.', safe: ['mover'], next: { node: 'release' }, objective: 26 }],
            mixed: [{ text: '{mover.first} gets out. {subject.first} trails the officers to the front and bolts the door after them.', safe: ['mover'], moves: { subject: 'provoked' }, next: { node: 'release' }, objective: 20 }],
            adverse: escalate({
              lead: '{subject.first} stands up and steps into the hall.',
              threat: '{subject.first} raises the weapon between the team and {mover.first}’s door.',
              finds: '{subject.first} gets to the bedroom first and shuts {subject.himself} in with {mover.first}.',
              quiet: 'The officers retreat to the porch. {subject.first} sits back down on the boxes.',
              quietHeld: 'Officers leave the house, and {subject.first} goes back to sit with {mover.first}.',
              extra: { moves: { subject: ['team_seen', 'provoked'] }, back: true, pressure: 8 } }),
          } },
        { id: 'list_standoff', title: 'Offer to take the list', icon: 'handover', talksTo: 'subject', check: check(TALK, 2), minutes: 8, authority: { concede: 'statement' }, onlyIf: { notMarks: ['list_promised'] },
          modifiers: [{ label: 'You carry the porch flap', mark: 'has_list', value: 8 }, { label: 'You heard {subject.first} read it', mark: 'list_told', value: 4 }],
          summary: '{lead} offers to write the list after all, to pass to {sibling.first}. Coming late, the offer may sound like a trick.',
          preview: { favorable: '{subject.first} gives you the list and decides about {mover.first}.', mixed: 'You take down every item, and nothing else moves.', adverse: '{subject.first} takes the offer as a trick, with the weapon close.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} stops the list halfway, unbolts the front, sends {mover.first} out ahead and follows with empty hands.', reveal: ['comes_out'], ...walksOut, safe: ['mover'], promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'everyone_out' }, objective: 46 },
              { if: STAYS, text: 'The officers copy down each item. Then {subject.first} lets {mover.first} slip out the back and stays.', reveal: ['comes_out'], safe: ['mover'], promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { node: 'release' }, objective: 24 },
            ],
            mixed: heldEnd({ text: 'The list is long and the night is longer. {subject.first} keeps the door bolted.', promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], objective: 8 },
              '{subject.first} reads the list aloud, with {mover.first} beside {subject.him}.'),
            adverse: escalate({
              lead: '“Now you want my list,” {subject.first} says.',
              threat: '{subject.first} keeps talking as the weapon rises toward {mover.first}’s door.',
              finds: '{subject.first} lets the receiver fall, crosses the bedroom and yanks the closet wide.',
              quiet: '{subject.first} leaves the receiver off the hook.',
              quietHeld: '{subject.first} lets the line go silent and keeps {mover.first} company in the bedroom.',
              extra: { moves: { subject: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'all_night', title: 'Hold the perimeter all night', icon: 'wait', check: check(HOLD, -12), minutes: 45, span: 'All night',
          summary: 'You hold the street and wait for {subject.first} to decide. {mover.first} spends the night in the closet if nothing changes.',
          preview: { favorable: 'The front door opens by first light.', mixed: '{mover.first} gets out at dawn, and {subject.first} doesn’t.', adverse: 'Dawn comes, and the house is still shut with {mover.first} inside.' },
          outcomes: {
            favorable: [
              { if: [COMES, BOXES_OK], text: '{subject.first} unlatches the front door as day breaks, lays the weapon down on the step and walks out. Officers find {mover.first} asleep in the bedroom, still in work gloves.', reveal: ['comes_out'], ...walksOut, safe: ['mover'], next: { ending: 'out_after_dark' }, objective: 40 },
              { if: [STAYS, BOXES_OK], text: '{subject.first} opens up at dawn for {mover.first}, then slides the bolt across again.', reveal: ['comes_out'], safe: ['mover'], next: { node: 'release' }, objective: 24 },
              { if: BOXES_OUT, text: 'The closet opens in the night. By morning {mover.first} is out the front, sent by {subject.first}.', reveal: ['knows_mover'], safe: ['mover'], next: { node: 'release' }, objective: 24 },
            ],
            mixed: [{ text: '{mover.first} leaves by the back door at dawn while {subject.first} remains in the house.', safe: ['mover'], next: { node: 'release' }, objective: 18 }],
            adverse: heldEnd({ text: 'Morning comes. Nobody has come out, and the boxes are stacked against the front door.', pressure: 6 },
              'The closet is open, and {subject.first} sits with {mover.first}.'),
          } },
        { id: 'pull_back', title: 'Pull back to the truck', icon: 'handover', check: check(MOVE, -20), minutes: 2,
          summary: 'You leave the house to {subject.first} and end the call. {mover.first} is still inside.',
          preview: { favorable: 'With nobody in sight, {subject.first} may let {mover.first} go.', mixed: 'You keep the street shut while {subject.first} stays inside with {mover.first}.', adverse: 'You give up the windows, and nobody comes out.' },
          outcomes: {
            favorable: [{ text: 'Officers withdraw to the moving truck. With the street quiet, {subject.first} opens the back door and lets {mover.first} go.', safe: ['mover'], moves: { subject: 'released' }, next: { ending: 'mover_out_held' }, objective: 12 }],
            mixed: heldEnd({ text: 'Officers fall back and close the street. The boxes inside start moving again.', objective: 5 },
              '{subject.first} stands in the bedroom doorway, and {mover.first} is behind {subject.him}.'),
            adverse: heldEnd({ text: 'The team leaves the windows and waits at the corner.', objective: 5 },
              '{subject.first} stands in {mover.first}’s doorway, the last thing the officers see.'),
          } },
      ] },

    { id: 'release', stage: 'resolve',
      prompt: '{mover.first} is out with the medic. {subject.first} is alone in the house with the weapon.',
      choices: [
        { id: 'talk_out', title: 'Talk {subject.him} out', icon: 'radio', talksTo: 'subject', check: check(TALK, 6), minutes: 6,
          summary: '{lead} invites {subject.first} to walk out with empty hands. With {mover.first} gone, {subject.first} has nothing left to hold out for.',
          preview: { favorable: '{subject.first} tells you plainly whether {subject.he} will come out.', mixed: 'The list has to come first for {subject.first}.', adverse: 'You lose the line, and the door stays locked.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} props the weapon by the front steps and crosses the lawn, hands open.', reveal: ['comes_out'], ...walksOut, next: { ending: 'everyone_out' }, objective: 40 },
              { if: STAYS, text: '{subject.first} thanks the team for asking and says the answer is no.', reveal: ['comes_out'], next: { ending: 'mover_out_held' }, objective: 20 },
            ],
            mixed: [
              { when: { notMarks: ['list_promised'] }, text: '{subject.first} says to get everything on paper, then ask again.', next: { node: 'release_list' }, objective: 10 },
              { when: { marks: ['list_promised'] }, text: '{subject.first} asks to hear the list once more before deciding.', next: { node: 'release_list' }, objective: 10 },
            ],
            adverse: [{ text: '{subject.first} bolts the door and stops answering.', moves: { subject: 'provoked' }, next: { ending: 'mover_out_held' }, objective: 10 }],
          } },
        { id: 'list_now', title: 'Write the list down now', icon: 'handover', talksTo: 'subject', check: check(TALK, -2), minutes: 8, authority: { concede: 'statement' }, onlyIf: { notMarks: ['list_promised'] },
          modifiers: [{ label: 'The box flap is in hand', mark: 'has_list', value: 8 }, { label: 'The list, in {subject.first}’s words', mark: 'list_told', value: 4 }],
          summary: '{lead} copies out every item for {sibling.first}. {subject.first} stays on the phone and can still say no.',
          preview: { favorable: '{subject.first} hears the list back and gives you an answer.', mixed: '{subject.first} asks for the night before answering.', adverse: '{subject.first} says the list is too late.' },
          outcomes: {
            favorable: [
              { if: COMES, text: 'The list is read back to {subject.first}, who comes out with it folded in {subject.his} pocket.', reveal: ['comes_out'], ...walksOut, promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'everyone_out' }, objective: 40 },
              { if: STAYS, text: '{subject.first} agrees to every line, then says {subject.he} {subject~is|are} staying put.', reveal: ['comes_out'], promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'mover_out_held' }, objective: 20 },
            ],
            mixed: [{ text: 'Every item is on paper. {subject.first} wants until morning before deciding.', promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { node: 'release_list' }, objective: 12 }],
            adverse: [{ text: '{subject.first} says it’s too late for a list and puts the receiver down hard.', moves: { subject: 'provoked' }, next: { ending: 'mover_out_held' }, objective: 8 }],
          } },
        { id: 'night', title: 'Hold the house overnight', icon: 'wait', check: check(HOLD, -10), minutes: 45, span: 'All night',
          summary: 'You wait out the night with {subject.first} in the house by {subject.himself}, the weapon close by.',
          preview: { favorable: 'Morning brings an answer from {subject.first}.', mixed: '{subject.first} talks at dawn but keeps the door shut.', adverse: 'The door stays bolted until daylight.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} steps outside at daybreak. The weapon stays behind on the kitchen table.', reveal: ['comes_out'], ...walksOut, next: { ending: 'out_after_dark' }, objective: 36 },
              { if: STAYS, text: 'The sun comes up with {subject.first} still sitting among the boxes.', reveal: ['comes_out'], next: { ending: 'mover_out_held' }, objective: 18 },
            ],
            mixed: [{ text: '{subject.first} answers the phone in the morning but won’t open the door.', next: { ending: 'mover_out_held' }, objective: 14 }],
            adverse: [{ text: '{subject.first} never answers, and the bolt stays across the door all night.', next: { ending: 'mover_out_held' }, objective: 10 }],
          } },
      ] },

    { id: 'release_list', stage: 'resolve',
      prompt: '{subject.first} won’t decide anything until the list is settled. {mover.first} is safe.',
      promptIf: [{ when: { marks: ['list_promised'] }, prompt: '{subject.first} has every item written down and the night to think. {mover.first} is out.' }],
      choices: [
        { id: 'list_first', title: 'Take the list down first', icon: 'handover', talksTo: 'subject', check: check(TALK, -2), minutes: 8, authority: { concede: 'statement' }, onlyIf: { notMarks: ['list_promised'] },
          modifiers: [{ label: 'The flap is already here', mark: 'has_list', value: 8 }, { label: '{subject.first} said the items aloud', mark: 'list_told', value: 4 }],
          summary: '{lead} copies the items down one by one for {sibling.first}. Seeing them on paper makes the sale real, and {subject.first} could balk.',
          preview: { favorable: '{subject.first} answers you when the list is finished.', mixed: 'Every item is written, and {subject.first} still won’t answer.', adverse: '{subject.first} hangs up partway through.' },
          outcomes: {
            favorable: [
              { if: COMES, text: 'With the last item on paper, {subject.first} folds the copy into a pocket and comes outside.', reveal: ['comes_out'], ...walksOut, promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'everyone_out' }, objective: 40 },
              { if: STAYS, text: 'The list is complete, and {subject.first} still refuses to come out.', reveal: ['comes_out'], promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'mover_out_held' }, objective: 18 },
            ],
            mixed: [{ text: 'Every item goes down. {subject.first} says nothing more tonight.', promise: { id: 'list', to: 'subject', kind: 'statement' }, mark: ['list_promised'], next: { ending: 'mover_out_held' }, objective: 12 }],
            adverse: [{ text: 'The line goes quiet halfway down the list.', moves: { subject: 'provoked' }, next: { ending: 'mover_out_held' }, objective: 6 }],
          } },
        { id: 'read_back', title: 'Read the list back', icon: 'handover', talksTo: 'subject', check: check(TALK), minutes: 6, onlyIf: { marks: ['list_promised'] },
          summary: '{lead} reads every item aloud. Each one is something {subject.first} won’t get to keep.',
          preview: { favorable: '{subject.first} hears every item and answers you.', mixed: '{subject.first} listens and says nothing back.', adverse: '{subject.first} stops listening halfway.' },
          outcomes: {
            favorable: [
              { if: COMES, text: 'The last item is the height marks. {subject.first} says that’s enough and comes out the front.', reveal: ['comes_out'], ...walksOut, next: { ending: 'everyone_out' }, objective: 36 },
              { if: STAYS, text: '{subject.first} hears the whole list through and still won’t leave.', reveal: ['comes_out'], next: { ending: 'mover_out_held' }, objective: 16 },
            ],
            mixed: [{ text: '{subject.first} listens to every item and says nothing at the end.', next: { ending: 'mover_out_held' }, objective: 12 }],
            adverse: [{ text: '{subject.first} hangs up at the clock.', moves: { subject: 'provoked' }, next: { ending: 'mover_out_held' }, objective: 8 }],
          } },
        { id: 'wait_dawn', title: 'Give {subject.him} until morning', icon: 'wait', check: check(HOLD, -10), minutes: 40, span: 'All night',
          summary: 'You give {subject.first} the night with the list. {subject.He} {subject~spends|spend} it alone in a house full of boxes.',
          preview: { favorable: 'Daylight brings {subject.first} to the phone with an answer.', mixed: '{subject.first} answers at dawn and stays.', adverse: 'The house stays dark and quiet.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} slides the bolt back as the sky gets light and steps out, the list folded small.', reveal: ['comes_out'], ...walksOut, next: { ending: 'out_after_dark' }, objective: 34 },
              { if: STAYS, text: 'Sunrise comes. {subject.first} tells the negotiator {subject.he} {subject~is|are} staying.', reveal: ['comes_out'], next: { ending: 'mover_out_held' }, objective: 16 },
            ],
            mixed: [{ text: '{subject.first} picks up at dawn, listens and sets the receiver back down.', next: { ending: 'mover_out_held' }, objective: 12 }],
            adverse: [{ text: 'No light comes on in the house before morning.', next: { ending: 'mover_out_held' }, objective: 8 }],
          } },
      ] },

    { id: 'threat', stage: 'resolve',
      prompt: '{subject.first} has the weapon raised at {mover.first}’s door. {mover.first} is behind that door.',
      choices: [
        { id: 'call_back', title: 'Call {subject.him} up front', icon: 'radio', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'subject' } }, talksTo: 'subject', check: check(TALK, 4), minutes: 3,
          summary: '{lead} shouts through the glass for {subject.first} to come back to the phone. Whoever shouts stands in the line of fire.',
          preview: { favorable: '{subject.first} leaves the door and picks up the landline.', mixed: '{subject.first} lets the weapon drop to {subject.his} side but stays by the door.', adverse: '{subject.first} may fire at the window, or open {mover.first}’s door.' },
          outcomes: {
            favorable: [{ text: '{subject.first} lowers the weapon and walks back to the front room.', moveTo: { subject: { to: 'scene', seen: true } }, moves: { subject: 'contact' }, next: { node: 'talking' }, objective: 12 }],
            mixed: [{ text: '{subject.first} points the weapon at the floor but stays outside {mover.first}’s door.', next: { node: 'standoff' }, objective: 6 }],
            adverse: [
              { if: BREAKING, text: 'The front window cracks under a shot as {subject.first} swings around.', fire: { from: 'subject' }, mark: ['shot_at'], next: { node: 'fired_on' }, pressure: 10 },
              { if: HOLDING, text: '{subject.first} opens {mover.first}’s door and goes through.', moveTo: { subject: { to: { room: 'mover' }, seen: true } }, next: { node: 'found' }, pressure: 6 },
            ],
          } },
        { ...goIn('go_in', 4, 'door', {
          summary: 'Anyone in that hall can be badly hurt, {mover.first} included. {lead} goes first while the weapon is still raised.',
          preview: { favorable: 'You reach {mover.first} and bring {mover.him} out the front.', mixed: 'You get {mover.first} out, and {subject.first} is hurt giving up the weapon.', adverse: 'Someone in that hall could end up badly hurt, maybe {mover.first}.' },
          clean: 'Officers fill the hall before {subject.first} turns. {mover.first} goes out the front, and the weapon is on the floor.',
          hurt: '{subject.first} is hurt when the team takes the weapon away. The medic starts on {subject.him} while {mover.first} gets clear.',
          trip: '{mover.first} trips over a box by the bedroom and goes down hard. One officer is hurt pulling {subject.first} off the weapon.',
          swing: '{subject.first} swings the weapon toward the team as they reach {mover.first}.' }),
          support: { at: 'exit', label: 'holding the front door' } },
        { id: 'step_away', title: 'Pull out of sight', icon: 'wait', check: check(HOLD, -2), minutes: 8,
          summary: 'You clear every window and leave the next move to {subject.first}. {mover.first} stays behind that door throughout.',
          preview: { favorable: '{subject.first} turns from the door and goes back to stacking.', mixed: '{subject.first} stays at the door, the weapon down.', adverse: '{subject.first} opens the bedroom door and goes in to {mover.first}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} rests the weapon in a corner once the windows are empty and lifts the next box.', moveTo: { subject: 'scene' }, next: { node: 'standoff' }, objective: 10 }],
            mixed: [{ text: '{subject.first} sits down outside {mover.first}’s door, the weapon across {subject.his} knees.', next: { node: 'standoff' }, objective: 6 }],
            adverse: [{ text: '{subject.first} pushes {mover.first}’s door open and steps through.', moveTo: { subject: { room: 'mover' } }, back: true, next: { node: 'found' }, pressure: 6 }],
          } },
      ] },

    { id: 'fired_on', stage: 'resolve',
      prompt: '{subject.first} has fired at your officers. {mover.first} is hiding down the hall.',
      choices: [
        goIn('go_in', 10, 'door', {
          summary: '{subject.first} has already fired once. {lead} goes in fast, and anyone between the front door and {mover.first} could get hurt.',
          preview: { favorable: 'You get to {mover.first} before a second shot.', mixed: '{subject.first} is hurt in the struggle, and {mover.first} reaches the street.', adverse: 'You meet {subject.first} armed in the hall, and someone there may be badly hurt.' },
          clean: 'Officers are through the front door fast. {subject.first} ends up on the floor without the weapon, and {mover.first} runs for the sidewalk.',
          hurt: 'Officers pin {subject.first} against the boxes and wrench the weapon loose. {subject.first} is hurt, and {mover.first} gets out.',
          trip: '{mover.first} falls down the porch steps in the rush. An officer gets hurt wrestling the weapon away from {subject.first}.',
          swing: '{subject.first} brings the weapon round on the first officer through the door.' }),
        { id: 'hold_cars', title: 'Call from behind the truck', icon: 'wait', talksTo: 'subject', check: check(HOLD), minutes: 10,
          summary: 'You crouch behind the moving truck and ring {subject.first} on the landline. {mover.first} waits, and so do you.',
          preview: { favorable: '{subject.first} talks to you again.', mixed: '{subject.first} answers once and hangs up again.', adverse: 'The landline rings unanswered, and both stay inside.' },
          outcomes: {
            favorable: [{ text: 'On the fourth call {subject.first} answers and says {subject.he} didn’t mean to fire.', moves: { subject: 'contact' }, next: { node: 'talking' }, objective: 10 }],
            mixed: heldEnd({ text: '“They’ll never get this house,” {subject.first} says, and the receiver clatters down.', objective: 4 },
              '{subject.first} has {mover.first} in the bedroom now.'),
            adverse: heldEnd({ text: 'The phone rings out, and the street stays shut.', pressure: 6 },
              'Officers at the back see {subject.first} and {mover.first} together in one room.'),
          } },
      ] },

    { id: 'found', stage: 'resolve',
      prompt: '{subject.first} has opened the closet and found {mover.first}. The two of them are in that bedroom.',
      promptIf: [{ when: { marks: ['at_the_door'] }, prompt: '{subject.first} is aiming the weapon at {mover.first} across the bedroom.' }],
      choices: [
        { id: 'talk_both', title: 'Talk through the window', icon: 'radio', team: { to: { vantage: 'mover' }, signal: { channel: 'voice', to: 'subject' } }, talksTo: 'subject', check: check(TALK, 2), minutes: 4,
          summary: '{lead} talks to {subject.first} through {mover.first}’s window. {mover.first} hears every word, and so does {subject.first}.',
          preview: { favorable: '{subject.first} lets {mover.first} go.', mixed: '{subject.first} holds {mover.first} there and goes on talking.', adverse: '{subject.first} may point the weapon at your voice.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} walks {mover.first} to the back door, then comes out after {mover.him} with empty hands.', reveal: ['comes_out', 'knows_mover'], safe: ['mover'], ...walksOut, next: { ending: 'walked_them_out' }, objective: 40 },
              { if: STAYS, text: '{subject.first} tells {mover.first} to go. {mover.first} slips out past the team, and {subject.first} shuts the closet.', reveal: ['comes_out'], safe: ['mover'], next: { node: 'release' }, objective: 26 },
            ],
            mixed: [
              { if: COMES, text: '{subject.first} perches on the mattress and says {mover.first} can leave after the list is done.', reveal: ['comes_out'], mark: ['found'], next: { node: 'standoff' }, objective: 10 },
              { if: STAYS, text: '{subject.first} keeps {mover.first} put and says {subject.he} won’t leave the house.', reveal: ['comes_out'], mark: ['found'], next: { node: 'standoff' }, objective: 6 },
            ],
            adverse: [
              { text: '{subject.first} tells the officers to get off the property.', moves: { subject: 'provoked' } },
              { if: BREAKING, text: 'The weapon swings toward the window, and everyone there hits the ground.', mark: ['aimed_in_room', 'found'], next: { node: 'found_raised' } },
              { if: HOLDING, text: '{subject.first} pulls the curtain across and stays in the room with {mover.first}.', mark: ['found'], next: { node: 'standoff' } },
            ],
          } },
        { id: 'give_room', title: 'Give {subject.him} time with {mover.first}', icon: 'wait', check: check(HOLD, -8), minutes: 20, span: 'Hours',
          summary: 'You let {subject.first} decide with {mover.first} in the room. {mover.first} spends that time beside the weapon.',
          preview: { favorable: '{subject.first} sends {mover.first} out.', mixed: '{subject.first} keeps {mover.first} there for hours.', adverse: '{subject.first} won’t let {mover.first} go.' },
          outcomes: {
            favorable: [
              { if: COMES, text: '{subject.first} walks {mover.first} out the back an hour later, then follows with nothing in {subject.his} hands.', reveal: ['comes_out', 'knows_mover'], safe: ['mover'], ...walksOut, next: { ending: 'walked_them_out' }, objective: 36 },
              { if: STAYS, text: '{mover.first} leaves through the back door after an hour, sent by {subject.first}, who stays.', reveal: ['comes_out'], safe: ['mover'], next: { node: 'release' }, objective: 22 },
            ],
            mixed: heldEnd({ text: 'Hours go by with both of them in that bedroom.', mark: ['found'], objective: 8 },
              '{mover.first} has been sitting on the closet floor the whole time.'),
            adverse: heldEnd({ text: '{subject.first} says {mover.first} stays until every box is back where it was.', mark: ['found'], moves: { subject: 'provoked' }, objective: 4 },
              '{subject.first} keeps to the doorway, the weapon in hand.'),
          } },
      ] },

    { id: 'found_raised', stage: 'resolve',
      prompt: '{mover.first} is pressed against the coats, and {subject.first} aims the weapon down at {mover.him}.',
      choices: [
        goIn('go_in_room', 6, 'room', {
          summary: '{lead} leads the way into the bedroom where {subject.first} stands over {mover.first}. Everyone in there is within reach of the weapon.',
          preview: { favorable: 'You pull {mover.first} clear of {subject.first}.', mixed: '{subject.first} gets hurt when you take the weapon away. {mover.first} comes out.', adverse: '{subject.first} fights you for the weapon, and someone in that room could be hurt badly.' },
          clean: 'Two officers are between {subject.first} and {mover.first} before the weapon moves. Both come out unhurt.',
          hurt: '{subject.first} hits the bed frame as officers pull the weapon free. {mover.first} is dragged out to the hall.',
          trip: '{mover.first} slams into the closet door scrambling clear. The officer who takes the weapon from {subject.first} is hurt.',
          swing: '{subject.first} wheels around and levels the weapon at two officers in the doorway.' }),
        { id: 'back_off', title: 'Back away from the window', icon: 'wait', check: check(HOLD, -2), minutes: 8,
          summary: 'You leave the window empty and let {subject.first} decide about the weapon. {mover.first} is a few feet away.',
          preview: { favorable: 'The weapon comes down to {subject.first}’s side.', mixed: 'The weapon stays up while {subject.first} talks to {mover.first}.', adverse: 'You lose sight of both of them, the weapon still raised.' },
          outcomes: {
            favorable: [{ text: '{subject.first} lays the weapon across the mattress and sits beside it.', back: true, next: { node: 'standoff' }, objective: 8 }],
            mixed: heldEnd({ text: '{subject.first} holds the weapon on {mover.first} and talks about the house.', back: true, objective: 4 },
              '{mover.first} hasn’t moved off the closet floor.'),
            adverse: heldEnd({ text: 'Officers wait at the corner. The curtain stays shut.', back: true, pressure: 6 },
              'The last sight through the window is the weapon raised in that bedroom.'),
          } },
      ] },
  ],
  endings: {
    everyone_out: { title: 'Everything goes back', disposition: 'resolved',
      summary: '{mover.first} is out with packing tape around one wrist. {subject.first} walked out to the team and stays with them. The boxes stay where {subject.first} stacked them in the hall.' },
    out_after_dark: { title: 'Out after a long night', disposition: 'resolved',
      summary: '{subject.first} came out at the end of the night and stands with the officers. {mover.first} is by the truck with the crew, and {sibling.first} still has the sale papers in hand.' },
    walked_them_out: { title: 'Walked out together', disposition: 'resolved',
      summary: '{subject.first} let {mover.first} leave first, then walked out after. Every box is still where {subject.he} set it down.' },
    mover_out_held: { title: 'Alone with the boxes', disposition: 'relief_partial', remainingTasks: ['Talk {subject.first} out the front door'],
      summary: '{mover.first} is out and with the crew. {subject.first} is alone inside with the weapon while command holds the street.' },
    held_with_mover: { title: 'Still in the closet', disposition: 'relief_partial', remainingTasks: ['Reach {mover.first} safely', 'Keep {subject.first} talking'],
      summary: 'Patrol keeps the street closed. {mover.first} never left the closet, and {subject.first} still has the weapon.' },
    held_found: { title: 'Both in the bedroom', disposition: 'relief_partial', remainingTasks: ['Get {mover.first} away from {subject.first}', 'Keep the line to {subject.first} open'],
      summary: 'Officers hold the corner. {subject.first} and {mover.first} share that bedroom now, with the weapon between them.' },
    entry_clean: { title: 'Out through the hall', disposition: 'resolved',
      summary: '{mover.first} is with the crew, unhurt. {subject.first} is with the officers now, and {sibling.first} looks away from the porch step where {subject.first} sits with two officers.' },
    entry_subject_hurt: { title: '{subject.first} hurt in the entry', disposition: 'resolved',
      summary: 'The medic is with {subject.first}, hurt when officers took the weapon. {mover.first} waits by the truck, unhurt.' },
    entry_mover_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{mover.first} is with the medic, hurt getting clear of the entry. {subject.first} is with the team now.' },
    subject_hurt_force: { title: 'Force used on {subject.first}', disposition: 'resolved',
      summary: 'Officers used force when {subject.first} turned the weapon on them, and {subject.first} was hurt. The medic was still working as the EMS crew drove off. {mover.first} is out and safe.' },
    handed_over: { title: 'Handed to command', disposition: 'unresolved', remainingTasks: ['Get everyone out of the house safely'],
      summary: 'Command takes over the scene, and the call stays open. {sibling.first} waits at the tape with the sale papers.' },
  },
  rewards: { funding: 2400, devPoints: 3, trust: 6, xp: 45 },
};
