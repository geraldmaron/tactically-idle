import type { CallTree, TreeChoice, TreeIf, TreeNext, TreeOutcome } from './types';

// One Last Signature, the M2 slice 5 pilot (design sheet: docs/calls/hostage-signature-design.md).
// A fired employee holds the owner who called them a thief (a victim, the target of the grievance)
// and a courier who walked in for a signature (an incidental hostage). One or two coworkers from the
// last shift may have come with them, to back a story, not to hold anyone: a counted group
// (`others`) whose text sits behind count conditions and whose members follow the taker's surrender
// by the cascade.
//
// Hidden truth: whether the taker trades the owner for a written account (lets_go), and whether a
// refusal turns the handgun on the owner (raised). Stage 3 escalation reads the meters too: the
// truth decides, or a taker past breaking point does it anyway (mark `turned`, a threat mark). In
// the second situation the owner's heart is a clock: the long holds fork on it, and anywhere else it
// runs out its `onOut` records the collapse and marks `owner_down` for the prompts.
//
// Routing-only outcomes carry no text of their own (`text: ''`): the line the player reads is the
// addendum beside them, so one line is never written twice to route by who is still inside.
//
// Self-harm screen (E4): applies to the taker. Fired, called a thief in front of the regulars, a
// grievance against a known person, a handgun. No path shows the taker's death (noDeathOnCard, force
// noFatal); the negotiator asks the direct question off the card. Content note and 988 debrief line
// drafted in the design sheet, pending O2 and R5.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const ASK = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
const check = (base: typeof TALK | typeof HOLD | typeof ASK | typeof MOVE | typeof ENTER, difficulty = 0): TreeChoice['check'] =>
  ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

/** Group conditions: text and choices that name the others exist only in calls that have them. */
const GROUP = { count: { role: 'others', min: 1 } } as const;
const GROUP_IN = { count: { role: 'others', min: 1 }, notMarks: ['others_out'] };
const LONE = { count: { role: 'others', max: 0 } } as const;

const RAISED: TreeIf = { fact: 'raised', is: true };
const CALM: TreeIf = { fact: 'raised', is: false };
const BREAKING: TreeIf = { meter: 'taker', stance: 'breaking' };
const HOLDING: TreeIf = { meter: 'taker', stance: 'breaking', is: false };
const LETS_GO = { fact: 'lets_go', is: true } as const;
const KEEPS = { fact: 'lets_go', is: false } as const;
const OWNER_OK = { clock: 'owner_condition', out: false } as const;
const OWNER_OUT = { clock: 'owner_condition', out: true } as const;

/** An adverse result that refuses or provokes the taker. `lead` is said either way, with `extra`
 * (marks, moves, pressure); then the truth decides whether the handgun comes up at the owner. With
 * `anyway`, a stage 3 fork: a taker past breaking point does it even when the truth says no. */
function escalate(opts: { lead: string; threat: string; anyway?: string; quiet: string; quietNext?: TreeNext; extra?: Partial<TreeOutcome> }): TreeOutcome[] {
  const { lead, threat, anyway, quiet, quietNext = { node: 'standoff' }, extra = {} } = opts;
  const out: TreeOutcome[] = [{ ...extra, text: lead }, { if: RAISED, text: threat, reveal: ['raised'], next: { node: 'threat' } }];
  if (!anyway) return [...out, { if: CALM, text: quiet, reveal: ['raised'], next: quietNext }];
  return [...out,
    { if: [CALM, BREAKING], text: anyway, mark: ['turned'], next: { node: 'threat' } },
    { if: [CALM, HOLDING], text: quiet, reveal: ['raised'], next: quietNext }];
}

/** The courier goes out with the owner when still inside. */
const courierToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['courier'] }, text, safe: ['courier'], ...extra });

/** The call ends with the owner still inside. `lead` is the line either way; `courierLine` is added
 * while the courier is inside and `downLine` once the owner has collapsed (the clock's onOut), and
 * the ending follows both: held_inside, held_both, owner_left_down or held_both_down. */
const heldEnd = (lead: TreeOutcome, courierLine: string, downLine: string): TreeOutcome[] => [
  lead,
  { when: { notSafe: ['courier'] }, text: courierLine },
  { when: { marks: ['owner_down'] }, text: downLine },
  { when: { safe: ['courier'], notMarks: ['owner_down'] }, text: '', next: { ending: 'held_inside' } },
  { when: { notSafe: ['courier'], notMarks: ['owner_down'] }, text: '', next: { ending: 'held_both' } },
  { when: { safe: ['courier'], marks: ['owner_down'] }, text: '', next: { ending: 'owner_left_down' } },
  { when: { notSafe: ['courier'], marks: ['owner_down'] }, text: '', next: { ending: 'held_both_down' } },
];

/** The taker comes out, and the group decides whether to follow (CASCADE_V1). */
const surrender = (all: string): Pick<TreeOutcome, 'out' | 'cascade'> =>
  ({ out: ['taker'], cascade: { leader: 'taker', group: 'others', next: { all: { ending: all }, some: { node: 'stayed_behind' }, none: { node: 'nobody_followed' } } } });

export const HOSTAGE_SIGNATURE: CallTree = {
  type: 'hostage_crisis',
  title: 'One Last Signature',
  roles: [
    { id: 'taker', label: 'former employee', pronouns: 'he', kind: 'subject', carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'handgun' } },
    { id: 'courier', label: 'courier', pronouns: 'he', kind: 'civilian' },
    { id: 'owner', label: 'shop owner', pronouns: 'she', kind: 'civilian' },
  ],
  groups: { others: { slot: 'subjects', leader: 'taker', label: 'coworker from the last shift' } },
  // A counter, a till and regulars: a shop floor, a sales floor or a bar.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 1 },
  summary: '{courier.first} should have left ten minutes ago. Now a fired worker with a handgun won’t let anyone go.',
  pressureLabel: '{owner.first} at the till',
  pressure: { start: 20, perMinute: 0.25, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{taker.first} worked the counter here until {owner.first} fired {taker.him}. Patrol says {taker.he} came back carrying a handgun, threatened the people inside and won’t let them go.',
    known: [
      '{taker.first} says {owner.first} accused {taker.him} of taking money from the till.',
      '{courier.first} told the dispatcher, “I only needed one signature.”',
      '{courier.first} says {owner.first} sat down hard when {taker.first} shoved past {owner.him}.',
      'The only street door faces the counter, where {taker.first} keeps {owner.first} close.',
    ],
    unknown: ['Whether {taker.first} will let {owner.first} leave'],
    responsibilities: ['Get {courier.first} and {owner.first} out', 'Bring {taker.first} and anyone with {taker.him} out alive'],
  },
  stageLabels: { assess: 'The offer', adapt: 'The till', resolve: 'Way out' },
  objectives: [
    { id: 'courier', label: 'Get {courier.first} out' },
    { id: 'owner', label: 'Get {owner.first} out' },
    { id: 'taker', label: 'Bring {taker.first} out alive' },
  ],
  // A taker past breaking point who turns on the owner although the truth said otherwise: a threat
  // to life the team saw, so command can approve going in (sim/authorization.ts).
  threatMarks: { turned: '{taker.first} turned the handgun on {owner.first}' },
  facts: {
    handgun: { public: true, source: 'Responding patrol', truth: true, label: 'Patrol’s handgun report',
      claim: 'Patrol says {taker.first} is holding a handgun on the people inside.',
      confirmed: 'The team saw the handgun at the counter.', disproved: 'The team could not see a handgun.' },
    lets_go: { label: '{taker.first}’s terms for {owner.first}', claim: '{taker.first} might let {owner.first} go without {owner.his} name on a statement.',
      confirmed: '{taker.first} says {owner.first} can go once {taker.his} side is written down.', disproved: '{taker.first} says {owner.first} signs or stays.' },
    owner_faint: { label: '{owner.first}’s condition', claim: 'How {owner.first} is holding up on the stool.',
      confirmed: '{owner.first} says {owner.his} chest has been tight since the shove.', disproved: '{owner.first} says {owner.he} {owner~is|are} shaken but all right.' },
    raised: { label: 'The view of the counter', claim: 'What officers at the glass see when {taker.first} stops answering.',
      confirmed: 'The team saw {taker.first} point the handgun at {owner.first}.', disproved: 'Through the glass, {taker.first} paces with the handgun down at {taker.his} side.',
      threat: '{taker.first} pointed the handgun at {owner.first}' },
  },
  situations: [
    { note: '{taker.He} {taker~wants|want} to be heard and will trade {owner.him} for a written account. Silence leaves {taker.him} pacing. The others came for {taker.him} and go where {taker.he} {taker~goes|go}.', truth: { lets_go: true, raised: false, owner_faint: false } },
    { note: '{taker.He} will trade, but a refusal turns the handgun on {owner.him}. {owner.He} {owner~is|are} unwell, and a long night costs {owner.him}.', truth: { lets_go: true, raised: true, owner_faint: true } },
    { note: '{taker.He} {taker~wants|want} {owner.his} signature and nothing less, and {taker~turns|turn} on {owner.him} when pressed. The others are loosely held and freeze when {taker.he} {taker~walks|walk}.', truth: { lets_go: false, raised: true, owner_faint: false } },
  ],
  turns: { courier_out: ['out_back_door', 'out_keys', 'out_six_years'] },
  difficulty: { base: 40, perTier: 4 },
  root: 'offer',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'offer', stage: 'assess',
      prompt: 'The 911 call came from the counter phone. {taker.first} says {courier.first} can walk out now, and {owner.first} stays.',
      promptIf: [{ when: GROUP, prompt: '{taker.first} will free {courier.first} and keep {owner.first}. {others}, off the same shift, {others#stands|stand} by the door.' }],
      choices: [
        { id: 'take_courier', title: 'Walk {courier.first} out now', icon: 'door', walks: 'courier', check: check(MOVE, -6), minutes: 2,
          summary: '{lead} waves {courier.first} out the front. {owner.first} stays with the one person in there who blames {owner.him}.',
          preview: { favorable: '{courier.first} makes it to the patrol car, and {owner.first} is left on the stool.', mixed: '{courier.first} gets clear, and {taker.first} hangs up on you.', adverse: '{taker.first} orders {courier.first} back before {courier.he} {courier~reaches|reach} the door.' },
          outcomes: {
            favorable: [
              { text: '{courier.first} goes out with {courier.his} bag, the delivery slip still in {courier.his} hand. Patrol puts {courier.him} behind the car.', safe: ['courier'], moves: { taker: 'released' }, next: { turn: 'courier_out' }, objective: 30, pressure: -3 },
              { when: GROUP, text: '{others.first} holds the door for {courier.first}, then steps back in.' },
            ],
            mixed: [{ text: '{courier.first} gets out. {taker.first} shouts that running is no part of the deal and slams the counter phone down.', safe: ['courier'], mark: ['hung_up'], moves: { taker: 'provoked' }, next: { turn: 'courier_out' }, objective: 25, pressure: 4 }],
            adverse: [{ text: '{taker.first} tells {courier.first} to sit back down. {courier.He} {courier~does|do}, two steps short of the door.', next: { node: 'both_inside' }, pressure: 8 }],
          } },
        { id: 'ask_both', title: 'Ask for {owner.first} too', icon: 'radio', talksTo: 'taker', check: check(TALK), minutes: 4,
          summary: '{lead} asks for {owner.first} as well. {courier.first} waits by the door while you push, and the offer may not last.',
          preview: { favorable: 'You learn {taker.first}’s price for {owner.first}.', mixed: '{taker.first} keeps the offer to {courier.first} alone and starts a countdown.', adverse: 'The offer is gone, and {courier.first} sits again.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} agrees to free {owner.first} once somebody writes down what happened to the money.', reveal: ['lets_go'], mark: ['terms'], moves: { taker: 'contact' }, next: { node: 'his_side' }, objective: 15 },
              { if: KEEPS, text: 'Only a statement with {owner.first}’s name on it will do, {taker.first} says. {courier.first} is still at the door.', reveal: ['lets_go'], next: { node: 'one_door' }, objective: 10 },
            ],
            mixed: [{ text: '{taker.first} says the offer covers {courier.first} and nobody else, and counts down from ten.', mark: ['counting'], moves: { taker: 'provoked' }, next: { node: 'one_door' }, pressure: 6 }],
            adverse: [{ text: '{taker.first} takes the offer back. {courier.first} sinks back onto the pile of boxes.', moves: { taker: 'provoked' }, next: { node: 'both_inside' }, pressure: 8 }],
          } },
        { id: 'hear_him', title: 'Let {taker.first} talk first', icon: 'radio', talksTo: 'taker', check: check(TALK, -3), minutes: 5,
          summary: '{lead} asks what happened with the money and listens. {courier.first} lingers by the door, bag on {courier.his} shoulder.',
          preview: { favorable: 'You hear why {taker.first} came back today.', mixed: '{taker.first} talks, then makes a signature the price of anyone leaving.', adverse: 'You get an open line and no voice on it.' },
          outcomes: {
            favorable: [
              { text: '{taker.first} says {owner.first} called {taker.him} a thief in front of the regulars and fired {taker.him} that afternoon. {taker.He} {taker~wants|want} a page saying {taker.he} took nothing.', moves: { taker: 'heard' }, next: { node: 'his_side' }, objective: 15, pressure: -6 },
              { when: GROUP, text: '{others} {others#nods|nod} along at every line.' },
            ],
            mixed: [{ text: '{taker.first} goes over the till count line by line. Then {taker.he} {taker~says|say} nobody leaves until {owner.first} signs a statement clearing {taker.him}.', mark: ['sign_demand'], moves: { taker: 'heard' }, next: { node: 'his_side' }, objective: 10 }],
            adverse: [{ text: 'The answers stop. The line stays open, and the shop radio is the only sound on it.', mark: ['silent'], next: { node: 'both_inside' }, pressure: 6 }],
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the courier is out (one turn per call)
    { id: 'out_back_door', stage: 'adapt',
      prompt: '{courier.first} says {taker.first} keeps looking at the back door. In the alley, its handle has turned twice.',
      promptIf: [
        { when: { marks: ['hung_up'] }, prompt: 'The call was cut off. {courier.first} says the back way out is all {taker.first} watches.' },
        { when: GROUP, prompt: '{courier.first} says {taker.first} kept eyeing the alley, and {others} kept eyeing {taker.first}.' },
      ],
      choices: [
        { id: 'team_alley', title: 'Cover the alley door', icon: 'perimeter', check: check(MOVE), minutes: 4, consequenceLevel: 'moderate',
          summary: '{lead} leads your squad down the alley, close enough to stop {taker.first} leaving with {owner.first}. Boots on gravel carry inside.',
          preview: { favorable: 'You reach the rear unheard, with {taker.first} still on the line.', mixed: 'You get there, but {taker.first} heard you coming and says so.', adverse: 'The crunch of gravel could send {taker.first} back to {owner.first} with {taker.his} handgun raised.' },
          outcomes: {
            favorable: [{ text: 'The team settles in beside the alley door. A minute later {taker.first} calls dispatch back to ask who is in {taker.his} alley.', mark: ['team_close'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: 'The team reaches the rear exit, and the gravel carries inside. Dispatch gets a call from {taker.first} saying the alley is full of police.', mark: ['team_close'], moves: { taker: 'team_seen', others: 'team_seen' }, next: { node: 'talking' }, pressure: 5 }],
            adverse: escalate({
              lead: 'Gravel crunches under the team, and {taker.first} hears every step.',
              threat: '{taker.first} yanks {owner.first} behind the register and aims at {owner.him}.',
              quiet: 'Calls go unanswered after that, with {taker.first} planted between {owner.first} and the front.',
              extra: { mark: ['team_close'], moves: { taker: 'team_seen', others: 'team_seen' }, pressure: 10 } }),
          } },
        { id: 'ask_door', title: 'Ask about the back door', icon: 'radio', talksTo: 'taker', check: check(TALK), minutes: 3,
          summary: '{lead} rings the counter to ask what {taker.first} wants out back. Now {taker.he} {taker~knows|know} somebody is watching that exit.',
          preview: { favorable: 'You find out how {taker.first} wants to leave.', mixed: '{taker.first} answers, then calls the rear door {taker.his} business.', adverse: '{taker.first} may go quiet and point {taker.his} handgun over the counter at {owner.first}.' },
          outcomes: {
            favorable: [{ text: '{taker.first} says {taker.he} {taker~wants|want} to walk out the back so the street doesn’t see {taker.him}. {taker.He} {taker~asks|ask} if that is allowed.', mark: ['wants_back'], moves: { taker: 'heard' }, next: { node: 'talking' }, objective: 12, pressure: -4 }],
            mixed: [{ text: 'Six rings go by before anyone picks up. “The back door’s my business,” {taker.first} says, and keeps the receiver to {taker.his} ear.', moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: 'The line goes dead mid-question.',
              threat: 'Through the front window, officers watch the handgun swing toward {owner.first}.',
              quiet: 'Behind the shelves, {taker.he} {taker~paces|pace} while the team’s calls ring out.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },
    { id: 'out_keys', stage: 'adapt',
      prompt: '{courier.first} says {taker.first} took {owner.first}’s keys and phone. The front door is locked from inside now.',
      promptIf: [
        { when: { marks: ['hung_up'] }, prompt: '{taker.first} cut the call. {courier.first} says {owner.first}’s keys went into {taker.his} pocket before the bolt turned.' },
        { when: GROUP, prompt: '{others.first} bolted the front on {taker.first}’s word once {courier.first} was out. {owner.first}’s keys are with {taker.first}.' },
      ],
      choices: [
        { id: 'spare_key', title: 'Get the landlord’s spare key', icon: 'door', check: check(MOVE, -8), minutes: 20,
          summary: 'The landlord is twenty minutes away. {owner.first} sits with {taker.first} until the key is in your hand.',
          preview: { favorable: 'The spare arrives while {taker.first} talks. If {owner.first} is unwell, {owner.he} may not last the wait.', mixed: 'The key comes late, and {taker.first} picks up without a word. {owner.first} could be on the floor by then.', adverse: 'The landlord never finds the key. {owner.first} may collapse waiting, or end up facing the handgun.' },
          outcomes: {
            favorable: [
              { text: 'The landlord gets the spare key to the corner.', mark: ['spare_key'], objective: 10 },
              { if: OWNER_OK, text: 'While the team waits, {taker.first} calls back to ask if {courier.first} got home.', moves: { taker: 'contact' }, next: { node: 'talking' } },
              { if: OWNER_OUT, text: 'By then {owner.first} has slid to the floor, and {taker.first} is shouting for help down the phone.', mark: ['owner_down'], next: { node: 'owner_down' } },
            ],
            mixed: [
              { text: 'Half an hour goes by before the landlord turns up with the key.', mark: ['spare_key'], moves: { taker: 'provoked' }, pressure: 6 },
              { if: OWNER_OK, text: 'When officers ring the counter, {taker.first} lifts the receiver and says nothing.', next: { node: 'talking' }, minutes: 10 },
              { if: OWNER_OUT, text: 'Inside, {owner.first} is stretched out on the tiles, and {taker.first} is yelling for a medic.', mark: ['owner_down'], next: { node: 'owner_down' }, minutes: 10 },
            ],
            adverse: [
              { text: 'The landlord can’t find the spare key anywhere.', pressure: 8 },
              { if: [OWNER_OK, RAISED], text: 'When the team calls back, the handgun is leveled at {owner.first}.', reveal: ['raised'], next: { node: 'threat' }, minutes: 8 },
              { if: [OWNER_OK, CALM], text: 'The line drops after {taker.first} says nobody is coming in.', reveal: ['raised'], next: { node: 'standoff' }, minutes: 8 },
              { if: OWNER_OUT, text: '{owner.first} has been folding over on the stool the whole time. {owner.He} {owner~is|are} down now, and {taker.first} won’t stop shouting.', mark: ['owner_down'], next: { node: 'owner_down' }, minutes: 8 },
            ],
          } },
        { id: 'ask_unlock', title: 'Get the front unlocked', icon: 'radio', talksTo: 'taker', check: check(TALK), minutes: 3,
          summary: '{lead} wants the bolt turned so {owner.first} could get out fast. Asking tells {taker.first} you are thinking about that door.',
          preview: { favorable: 'The front gets unbolted but stays shut.', mixed: '{taker.first} turns the lock, then asks who you plan to send through.', adverse: '{taker.first} hears “door” and blocks it, and {owner.first} could be looking at the handgun.' },
          outcomes: {
            favorable: [{ text: 'The front bolt slides back, and officers on the sidewalk hear it. {taker.first} says the door stays shut.', mark: ['door_open'], moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 12, pressure: -3 }],
            mixed: [{ text: 'The lock turns. {taker.first} asks twice who is coming through that door.', mark: ['door_open'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6, pressure: 3 }],
            adverse: escalate({
              lead: 'A shelf scrapes across the front door from inside.',
              threat: 'Cans scatter across the tiles. When the shelf stops, the handgun is on {owner.first}.',
              quiet: 'After that, the counter phone just rings.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },
    { id: 'out_six_years', stage: 'adapt',
      prompt: '{courier.first} says {taker.first} worked that counter six years and kept starting the story of {taker.his} last day.',
      promptIf: [
        { when: { marks: ['hung_up'] }, prompt: 'The receiver went down hard. Inside, {courier.first} heard about the final shift three times over.' },
        { when: GROUP, prompt: '{courier.first} says {others} backed up {taker.first}’s version of that shift word for word.' },
      ],
      choices: [
        { id: 'ask_courier', title: 'Ask {courier.first} about that day', icon: 'search', talksTo: 'courier', check: check(ASK), minutes: 5,
          summary: '{courier.first} tells you what {courier.he} heard inside. {owner.first} spends those minutes on the stool next to {taker.first}.',
          preview: { favorable: '{courier.first} gives you the story {taker.first} kept starting.', mixed: '{courier.first} remembers part of the story while the counter goes unanswered.', adverse: '{courier.first} can’t help much, and the handgun could swing to {owner.first} meanwhile.' },
          outcomes: {
            favorable: [{ text: '{courier.first} says the till came up short on {taker.first}’s last shift, and {owner.first} said so where the regulars could hear. {taker.first} told {courier.him} {taker.he} never took a cent.', mark: ['knows_story'], next: { node: 'talking' }, objective: 12 }],
            mixed: [{ text: '{courier.first} remembers the short till and not much more. Meanwhile the shop line rings once and stops.', mark: ['knows_story'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: '{courier.first} can’t say much that helps.',
              threat: 'An officer at the glass sees {taker.first} grab {owner.first} by the sleeve, handgun out.',
              quiet: 'The next call from the team rings out.',
              extra: { pressure: 8 } }),
          } },
        { id: 'call_now', title: 'Call the counter phone now', icon: 'radio', talksTo: 'taker', check: check(TALK, 2), minutes: 2,
          summary: '{lead} calls the counter at once. You start with only what {taker.first} told dispatch, and nothing of the last shift.',
          preview: { favorable: 'You get {taker.first} on the line, talking.', mixed: '{taker.first} wants to know what {courier.first} told you.', adverse: '{taker.first} ignores the ringing, and {owner.first} may face the handgun.' },
          outcomes: {
            favorable: [{ text: '{taker.first} answers on the second ring and asks if {courier.first} is all right.', moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{taker.first} asks what {courier.first} has been saying about {taker.him}. The team says only that {courier.first} is safe.', moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 5 }],
            adverse: escalate({
              lead: 'The counter phone rings out.',
              threat: 'Officers watching from the corner see {taker.first} bring the handgun up toward {owner.first}.',
              quiet: '{taker.first} sits up on the counter, the handgun beside {taker.him} on the wood.',
              extra: { pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: both still inside
    { id: 'both_inside', stage: 'adapt',
      prompt: 'The offer is off. {courier.first} sits on the boxes by the door.',
      promptIf: [
        { when: { marks: ['silent'] }, prompt: 'No word from {taker.first} now. {owner.first} waits at the register and {courier.first} near the entrance.' },
        { when: GROUP_IN, prompt: '{courier.first} is back on the boxes, and {others} {others#crowds|crowd} the doorway behind {courier.him}.' },
      ],
      choices: [
        { id: 'wait_silence', title: 'Hold the line in silence', icon: 'wait', talksTo: 'taker', check: check(HOLD, -4), minutes: 10,
          summary: 'You leave the next word to {taker.first}. {courier.first} and {owner.first} wait in there however long {taker.he} {taker~takes|take}.',
          preview: { favorable: '{taker.first} speaks first and wants to know who is out there.', mixed: 'The silence ends with word that nobody leaves.', adverse: 'The silence drags on, and {taker.first} may decide {owner.first} is to blame for it.' },
          outcomes: {
            favorable: [{ text: 'After ten quiet minutes, {taker.first} asks whether anyone is listening. {taker.He} {taker~sounds|sound} out of breath.', moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 10, pressure: -5 }],
            mixed: [{ text: '{taker.first} finally answers to say nobody walks out today.', next: { node: 'standoff' }, objective: 4 }],
            adverse: escalate({
              lead: 'Ten minutes pass with nothing on the line.',
              threat: 'From the street, officers see {taker.first} lift the handgun in {owner.first}’s direction.',
              quiet: 'The team can make out {taker.first} walking the aisle, the handgun hanging at {taker.his} side.',
              extra: { pressure: 8 } }),
          } },
        { id: 'ask_again', title: 'Ask again for {courier.first}', icon: 'door', walks: 'courier', talksTo: 'taker', check: check(TALK, 4), minutes: 3,
          summary: 'Once more, {lead} requests {courier.first} alone. Asking twice can harden {taker.first} against both of them.',
          preview: { favorable: '{courier.first} walks free, and {taker.first} keeps talking.', mixed: '{courier.first} leaves, and {taker.first} calls that the last favor.', adverse: '{taker.first} keeps {courier.first} on the boxes because you asked.' },
          outcomes: {
            favorable: [{ text: '{taker.first} tells {courier.first} to go. The slip is still blank in {courier.his} hand at the door.', safe: ['courier'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 25 }],
            mixed: [{ text: '{courier.first} picks up {courier.his} bag and goes. {taker.first} says no more favors after this one, and {owner.first} stays until {owner.he} {owner~signs|sign}.', safe: ['courier'], mark: ['sign_demand'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 20 }],
            adverse: [{ text: '{taker.first} says {courier.first} stays because the team asked. {courier.first} sits back down.', moves: { taker: 'provoked' }, next: { node: 'standoff' }, pressure: 8 }],
          } },
        { id: 'team_glass', title: 'Move up to the glass', icon: 'perimeter', check: check(MOVE), minutes: 3, consequenceLevel: 'moderate', onlyIf: LONE,
          summary: '{lead} brings your squad to the front windows, in plain sight of {taker.first}. Seeing you there could end the talking.',
          preview: { favorable: 'Once {taker.first} sees you, the phone gets answered.', mixed: '{taker.first} answers but moves {owner.first} out of view.', adverse: '{taker.first} retreats from the window and may drag {owner.first} along, handgun drawn.' },
          outcomes: {
            favorable: [{ text: '{taker.first} sees officers at the windows and picks up the counter phone to ask what they are waiting for.', mark: ['team_close'], moves: { taker: 'team_seen' }, next: { node: 'talking' }, objective: 8 }],
            mixed: [{ text: '{taker.first} answers, then pushes {owner.first} behind the shelves where nobody outside can see {owner.him}.', mark: ['team_close'], moves: { taker: 'team_seen' }, next: { node: 'talking' }, pressure: 6 }],
            adverse: escalate({
              lead: 'The blinds come down the moment {taker.first} spots the team.',
              threat: 'Through a gap in the slats, {taker.first} is holding {owner.first} by the arm, handgun raised.',
              quiet: 'The blinds stay down, and nobody picks up.',
              extra: { mark: ['team_close'], moves: { taker: 'team_seen' }, pressure: 8 } }),
          } },
        { id: 'free_others', title: 'Give {others.first} a way out', icon: 'door', talksTo: 'others', check: check(TALK, 2), minutes: 4, onlyIf: GROUP_IN,
          summary: '{lead} lets {others} know the front is open to {others.him}. {taker.first} hears you pulling {taker.his} people away.',
          preview: { favorable: '{others} {others#comes|come} out to you, and {taker.first} lets {others.him} go.', mixed: '{others.first} answers you but stays beside {taker.first}.', adverse: '{taker.first} keeps {others} where {others.he} {others~is|are} and could take it out on {owner.first}.' },
          outcomes: {
            favorable: [{ text: '{others} {others#files|file} out the street door with open palms when {taker.first} says go, and officers walk {others.him} clear.', out: ['others'], mark: ['others_out'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{others.first} answers, then says nobody is leaving {taker.first} in there alone.', moves: { others: 'heard' }, next: { node: 'talking' }, objective: 4 }],
            adverse: escalate({
              lead: '{taker.first} orders {others} to stay where {others.he} {others~is|are}.',
              threat: 'Then the handgun goes to {owner.first}, the one {taker.he} {taker~blames|blame} for all of it.',
              quiet: 'After that the line is dead, and nobody comes near the glass.',
              extra: { moves: { taker: 'provoked', others: 'provoked' }, pressure: 8 } }),
          } },
      ] },
    { id: 'his_side', stage: 'adapt',
      prompt: '{courier.first} is still by the door, waiting to see whether that page gets written.',
      promptIf: [
        { when: { marks: ['terms'] }, prompt: 'A written account would buy {owner.first}’s way out. {courier.first} is waiting near the boxes.' },
        { when: { marks: ['sign_demand'] }, prompt: '{taker.first} wants {owner.first}’s name under a page that clears {taker.him}, and nothing less.' },
        { when: GROUP_IN, prompt: 'The pad is still blank. {others} {others#keeps|keep} glancing at {courier.first} and the exit.' },
      ],
      choices: [
        { id: 'courier_first', title: 'Walk {courier.first} out first', icon: 'door', walks: 'courier', check: check(MOVE, -2), minutes: 2,
          summary: '{courier.first} leaves before anything is agreed. {owner.first} stays, and {taker.first} has one person left to bargain with.',
          preview: { favorable: '{courier.first} is clear, and {taker.first} keeps on about the money.', mixed: '{courier.first} is out, and the price for {owner.first} goes up.', adverse: '{taker.first} won’t let {courier.first} reach the exit.' },
          outcomes: {
            favorable: [{ text: '{courier.first} walks out, nothing signed, and {taker.first} returns to the till.', safe: ['courier'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 25 }],
            mixed: [{ text: '{courier.first} gets away. Now {owner.first} has to sign before anything else is said, {taker.first} tells the team.', safe: ['courier'], mark: ['sign_demand'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 20 }],
            adverse: [{ text: '{taker.first} steps in front of {courier.first}. No one goes anywhere until the writing is done, {taker.he} {taker~says|say}.', moves: { taker: 'provoked' }, next: { node: 'standoff' }, pressure: 6 }],
          } },
        { id: 'write_now', title: 'Write down {taker.his} side', icon: 'handover', talksTo: 'taker', check: check(TALK), minutes: 6, authority: { concede: 'statement' },
          modifiers: [{ label: '{taker.He} named {taker.his} terms', mark: 'terms', value: 8 }],
          summary: '{lead} takes {taker.first}’s words down to pass on. The page will carry no signature but {taker.hers}.',
          preview: { favorable: 'You get {taker.first}’s side on paper, and {owner.first} may walk.', mixed: 'The account goes down on paper, but {owner.first} stays put.', adverse: '{taker.first} asks you to call {owner.first} a liar. When you won’t, {owner.first} may pay for it.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'For six minutes the team writes while {taker.first} talks. Then {taker.he} {taker~waves|wave} {courier.first} and {owner.first} out, and the two of them leave together.', reveal: ['lets_go'], safe: ['courier', 'owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 55, pressure: -10 },
              { if: KEEPS, text: 'Every word goes on the pad. Then {taker.first} says none of it counts until {owner.first} signs.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 15 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} frees {courier.first} but keeps {owner.first} at the register while the notes are read back.', reveal: ['lets_go'], safe: ['courier'], mark: ['account'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 35 },
              { if: KEEPS, text: 'Once the account is done, {taker.first} calls it worthless without {owner.first}’s name.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 12 },
            ],
            adverse: escalate({
              lead: '{taker.first} wants the negotiator to say {owner.first} lied, and the negotiator won’t.',
              threat: '{taker.He} {taker~levels|level} the handgun across the till before the negotiator can finish a sentence.',
              quiet: 'Then {taker.he} {taker~says|say} {owner.first} can sit there until {owner.he} {owner~signs|sign}.',
              extra: { moves: { taker: 'provoked' }, pressure: 6 } }),
          } },
        { id: 'owner_voice', title: 'Ask to hear from {owner.first}', icon: 'radio', check: check(TALK, 2), minutes: 4,
          summary: '{owner.first} speaks for {owner.himself}, if {owner.he} {owner~wants|want} to. Every word {owner.he} {owner~says|say} about signing reaches {taker.first} too.',
          preview: { favorable: '{owner.first} comes on the line and tells you how {owner.he} {owner~is|are}.', mixed: '{owner.first} gets the phone and refuses to sign.', adverse: '{taker.first} keeps {owner.first} away from the receiver.' },
          outcomes: {
            favorable: [
              { if: { fact: 'owner_faint', is: false }, text: '{owner.first} asks for {owner.his} reading glasses from the back. {taker.first} lets {owner.him} fetch them.', reveal: ['owner_faint'], mark: ['owner_heard'], next: { node: 'talking' }, objective: 10 },
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} is short of breath and says {owner.he} {owner~needs|need} to lie down. {owner.His} chest hurts.', reveal: ['owner_faint'], mark: ['owner_heard', 'owner_unwell'], next: { node: 'talking' }, objective: 10 },
            ],
            mixed: [
              { if: { fact: 'owner_faint', is: false }, text: '{owner.first} won’t sign anything {owner.he} {owner~doesn’t|don’t} believe. The receiver is snatched back before {owner.he} can say more.', reveal: ['owner_faint'], mark: ['owner_heard', 'sign_demand'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 6 },
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} refuses to sign, then has to stop for air. The phone is pulled out of {owner.his} hand.', reveal: ['owner_faint'], mark: ['owner_heard', 'owner_unwell', 'sign_demand'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 6 },
            ],
            adverse: [{ text: '{taker.first} says {owner.first} can talk once {owner.he} {owner~signs|sign}, and holds on to the receiver.', next: { node: 'standoff' }, pressure: 5 }],
          } },
      ] },
    { id: 'one_door', stage: 'adapt',
      prompt: '{courier.first} can still walk out. For {owner.first}, the price is a signature.',
      promptIf: [
        { when: { marks: ['counting'] }, prompt: 'The count from ten has started. The door is open for {courier.first} only.' },
        { when: GROUP, prompt: '{others} {others#stands|stand} nearest the exit, and {courier.first} is right behind {others.him}.' },
      ],
      choices: [
        { id: 'take_while', title: 'Take {courier.first} while you can', icon: 'door', walks: 'courier', check: check(MOVE, -4), minutes: 2, onlyIf: LONE,
          summary: '{courier.first} goes on the offer as it stands. {owner.first} stays, the only person {taker.first} has left to hold.',
          preview: { favorable: '{courier.first} walks, and {taker.first} lets {courier.him} go.', mixed: '{courier.first} makes it outside, and {taker.first} stops answering.', adverse: '{taker.first} calls {courier.first} back before the door.' },
          outcomes: {
            favorable: [
              { when: { marks: ['counting'] }, text: '{courier.first} slips out, bag in hand. The count stops at four.', safe: ['courier'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 25 },
              { when: { notMarks: ['counting'] }, text: '{taker.first} watches {courier.first} go and doesn’t say a word.', safe: ['courier'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 25 },
            ],
            mixed: [{ text: '{courier.first} gets clear of the shop. Every call after that goes unanswered.', safe: ['courier'], mark: ['silent'], next: { node: 'standoff' }, objective: 20, pressure: 4 }],
            adverse: [{ text: 'Before {courier.first} reaches the door, {taker.first} tells {courier.him} to sit. Nobody leaves.', moves: { taker: 'provoked' }, next: { node: 'standoff' }, pressure: 8 }],
          } },
        { id: 'others_courier', title: 'Let {others.first} take {courier.first} out', icon: 'door', walks: 'courier', talksTo: 'others', check: check(TALK), minutes: 3, onlyIf: GROUP,
          summary: '{lead} invites {others} to walk {courier.first} out and stay out. Every word reaches {taker.first}.',
          preview: { favorable: '{others} {others#escorts|escort} {courier.first} out, and {taker.first} doesn’t stop them.', mixed: '{courier.first} gets out, though {others.first} returns to {taker.first}.', adverse: '{taker.first} stops all of them, and {owner.first} may be the one who pays.' },
          outcomes: {
            favorable: [{ text: '{others} {others#takes|take} {courier.first} to the curb with a wave from {taker.first}, and the team meets {others.him} there.', safe: ['courier'], out: ['others'], mark: ['others_out'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 25 }],
            mixed: [{ text: '{others.first} opens up for {courier.first}, then goes back to stand by {taker.first}.', safe: ['courier'], moves: { taker: 'released', others: 'heard' }, next: { node: 'standoff' }, objective: 20 }],
            adverse: escalate({
              lead: '{taker.first} beats {others.first} to the door and puts a hand on the bolt.',
              threat: 'The handgun comes around to {owner.first}, and {courier.first} drops to the floor by the boxes.',
              quiet: 'Nobody gets out. {taker.first} orders the negotiator to stop talking to {taker.his} people.',
              extra: { moves: { taker: 'provoked', others: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'honest_limit', title: 'Rule out the signature', icon: 'radio', talksTo: 'taker', check: check(TALK, 3), minutes: 3,
          summary: '{lead} tells {taker.first} plainly that nobody can make {owner.first} sign. {taker.He} may stop talking to someone who can’t deliver.',
          preview: { favorable: '{taker.first} goes quiet, then asks what else you can do.', mixed: 'The talking goes on, but nobody walks out.', adverse: '{taker.first} stops answering and might aim at {owner.first}.' },
          outcomes: {
            favorable: [{ text: '{taker.first} says nothing for a long minute. Then {taker.he} {taker~asks|ask} what the team can do for {taker.him}.', moves: { taker: 'honest' }, next: { node: 'talking' }, objective: 12 }],
            mixed: [{ text: '{taker.first} says {taker.he}’ll wait for {owner.first} to change {owner.his} mind. Both of them stay inside.', moves: { taker: 'honest' }, next: { node: 'standoff' }, objective: 6 }],
            adverse: escalate({
              lead: 'The line drops in the middle of the answer.',
              threat: 'An officer on the sidewalk sees the handgun pointed at {owner.first}.',
              quiet: '{taker.first} is slumped against the shelves, the handgun resting on {taker.his} knee.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'offer_record', title: 'Offer a written account instead', icon: 'handover', talksTo: 'taker', check: check(TALK), minutes: 5, authority: { concede: 'statement' },
          summary: 'You offer {taker.first} {taker.his} own words on paper. That is less than the signature {taker.he} asked for.',
          preview: { favorable: '{courier.first} walks free while {taker.first} tells {taker.his} side.', mixed: '{taker.first} takes the deal, but only with {owner.first} listening.', adverse: '{taker.first} says writing isn’t signing, and {owner.first} may end up in the line of fire.' },
          outcomes: {
            favorable: [{ text: '{taker.first} starts with {taker.his} first day at that counter, and frees {courier.first} before reaching the last one.', safe: ['courier'], mark: ['account'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 30 }],
            mixed: [{ text: '{taker.first} agrees to give {taker.his} side, but only on the speaker with {owner.first} hearing every word.', mark: ['account'], moves: { taker: 'heard' }, next: { node: 'talking' }, objective: 12 }],
            adverse: escalate({
              lead: '“Paper isn’t a signature,” {taker.first} tells the negotiator.',
              threat: 'Inside, the handgun swings toward the stool.',
              quiet: 'The receiver goes face down on the counter.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'talking', stage: 'resolve',
      prompt: 'The negotiator still has the line open. {owner.first} hasn’t left {owner.his} stool.',
      promptIf: [
        { when: { marks: ['owner_unwell'] }, prompt: '{owner.first} is sitting on the tiles near the till while the call goes on.' },
        { when: { marks: ['wants_back'] }, prompt: 'The alley door is the exit {taker.first} asked for. {owner.first} waits behind the register.' },
        { when: { notSafe: ['courier'] }, prompt: 'The negotiator has {taker.first} talking. {courier.first} is near the entrance, and {owner.first} is by the till.' },
        { when: { ...GROUP, marks: ['others_out'] }, prompt: 'With {others} gone, {taker.first} is alone in there with {owner.first} and the phone.' },
        { when: GROUP_IN, prompt: 'The receiver is in {taker.first}’s hand. {others} {others#hovers|hover} near {owner.first}.' },
      ],
      choices: [
        { id: 'take_account', title: 'Take down {taker.his} account', icon: 'handover', talksTo: 'taker', check: check(TALK), minutes: 6, onlyIf: { notMarks: ['account'] }, authority: { concede: 'statement' },
          modifiers: [{ label: '{courier.first} filled you in', mark: 'knows_story', value: 6 }, { label: '{owner.first} spoke for {owner.himself}', mark: 'owner_heard', value: 4 }],
          summary: '{lead} writes down every word as {taker.first} talks. The account settles nothing about the till, and {taker.he} will hear that.',
          preview: { favorable: 'You get the whole account down, and {taker.first} makes a decision about {owner.first}.', mixed: 'The account gets finished, but the handgun never leaves {taker.first}’s hand.', adverse: '{taker.first} wants you to side against {owner.first}. Refusing could put {owner.first} in danger.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'Six years at the counter go into the officers’ notes. {taker.first} sets the handgun down and sends {owner.first} out. Officers call {taker.him} out next and take {taker.him} at the door.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, ...surrender('everyone_out'), objective: 80, pressure: -10 },
              courierToo('{courier.first} walks out beside {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: 'Once every word is down, {taker.first} says it changes nothing until {owner.first} signs.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 12 },
            ],
            mixed: [
              { if: LETS_GO, text: 'When the account is complete, {owner.first} gets to leave, and {taker.first} keeps a grip on the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} follows {owner.first} out into the street.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} makes the negotiator read the account back so {owner.first} has to listen, and {owner.he} {owner~stays|stay} put.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 10 },
            ],
            adverse: escalate({
              lead: '{taker.first} asks the team to agree {owner.first} lied about the till. The team won’t.',
              threat: 'The handgun comes up at {owner.first}. The officer at the side window radios it in.',
              anyway: 'One refusal too many, and {owner.first} is suddenly at the wrong end of the handgun.',
              quiet: '{taker.first} says the statement will wait for {owner.first}’s name.',
              extra: { moves: { taker: 'provoked' }, pressure: 6 } }),
          } },
        { id: 'ask_owner', title: 'Ask for {owner.first} now', icon: 'radio', talksTo: 'taker', check: check(TALK, 6), minutes: 2, onlyIf: { ...LONE, notMarks: ['door_open'] },
          modifiers: [{ label: '{taker.His} account is written down', mark: 'account', value: 8 }],
          summary: '{lead} presses for {owner.first} and offers nothing new in return. {taker.first} may hear it as an order.',
          preview: { favorable: '{taker.first} makes up {taker.his} mind about {owner.first} on the spot.', mixed: '{taker.first} keeps hold of the handgun, and maybe {owner.first} too.', adverse: 'A demand is what {taker.first} hears, and the handgun may come up toward {owner.first}.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'After a moment, {taker.first} waves {owner.first} toward the door. {owner.He} {owner~walks|walk} out without {owner.his} coat.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} is a step behind {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} repeats that {owner.first} puts {owner.his} name down first, and hangs up on the next question.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 5 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} releases {owner.first} but keeps to the counter, still gripping the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} is a pace ahead of {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: 'Nobody gets released on demand. {owner.first} goes back to the stool.', reveal: ['lets_go'], next: { node: 'standoff' } },
            ],
            adverse: escalate({
              lead: '“Nobody gives me orders,” {taker.first} says.',
              threat: 'From the side window, an officer sees {taker.him} take aim at {owner.first}.',
              anyway: '{taker.first} has taken one push too many and thrusts the handgun out toward {owner.first}.',
              quiet: '{taker.He} {taker~stops|stop} picking up after that.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'others_walk_owner', title: 'Let {others.first} see {owner.first} out', icon: 'door', talksTo: 'taker', check: check(TALK, 2), minutes: 3, onlyIf: GROUP_IN,
          modifiers: [{ label: 'The account is on paper', mark: 'account', value: 6 }],
          summary: '{lead} proposes that {owner.first} leave with {others}. A no tells {taker.first} you are after {taker.his} people too.',
          preview: { favorable: '{others} {others#guides|guide} {owner.first} out, or {taker.first} sends {others.him} off alone.', mixed: '{others} {others#ends|end} up at the till beside {taker.first}, who keeps the handgun.', adverse: '{taker.first} turns on all of them, and {owner.first} is the nearest.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'At a nod from {taker.first}, {others} {others#brings|bring} {owner.first} through the street door, and officers meet them outside.', reveal: ['lets_go'], safe: ['owner'], out: ['others'], mark: ['others_out'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 48 },
              courierToo('{courier.first} comes along behind them.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} tells {others} to go if {others.he} {others~wants|want}, but {owner.first} stays. The street door shuts behind {others.him} alone.', reveal: ['lets_go'], out: ['others'], mark: ['others_out'], next: { node: 'standoff' }, objective: 14 },
            ],
            mixed: [
              { if: LETS_GO, text: '{others} {others#gets|get} {owner.first} as far as the door. {taker.first} orders {others.him} to the till and keeps the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released', others: 'heard' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} slips out through the open door.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} says {owner.first} isn’t anybody’s to walk anywhere. {others} {others#stays|stay} by the till.', reveal: ['lets_go'], moves: { others: 'heard' }, next: { node: 'standoff' }, objective: 6 },
            ],
            adverse: escalate({
              lead: '{taker.first} hears what the negotiator is asking {taker.his} people to do.',
              threat: '{taker.He} {taker~shoves|shove} {others} back and {taker~aims|aim} at {owner.first}.',
              anyway: '{taker.He} {taker~has|have} been pushed past answering. The handgun finds {owner.first} before {others} can move.',
              quiet: '{taker.He} {taker~tells|tell} {others} to sit down and hangs up on the negotiator.',
              extra: { moves: { taker: 'provoked', others: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'quiet_exit', title: 'Open the front for {owner.first}', icon: 'door', walks: 'owner', check: check(MOVE, 2), minutes: 3, consequenceLevel: 'high', onlyIf: { marks: ['spare_key'], safe: ['courier'] },
          summary: 'Officers unlock the street door while {lead} keeps {taker.first} talking. One glance up puts {owner.first} in {taker.his} sights.',
          preview: { favorable: '{owner.first} is outside before {taker.first} looks up.', mixed: '{owner.first} makes it, and {taker.first} sees the door swing shut.', adverse: '{taker.first} looks up as the door opens, with {owner.first} still in reach.' },
          outcomes: {
            favorable: [{ text: '{owner.first} slips out while {taker.first} is still talking about the till. {taker.He} only {taker~stops|stop} when the bell over the door rings.', safe: ['owner'], next: { node: 'last_one' }, objective: 45 }],
            mixed: [{ text: '{owner.first} is gone through the door. {taker.first} sees it close and shouts that the team tricked {taker.him}, the handgun in {taker.his} fist.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'provoked' }, next: { node: 'last_one' }, objective: 38 }],
            adverse: escalate({
              lead: 'The bell jangles, and {taker.first} glances up.',
              threat: '{taker.He} {taker~swings|swing} the handgun toward {owner.first} in the doorway.',
              anyway: '{taker.He} {taker~yells|yell} that everyone is lying to {taker.him} and {taker~covers|cover} {owner.first} with the handgun.',
              quiet: '{taker.He} {taker~calls|call} {owner.first} back, and {owner.he} {owner~sits|sit} down on the stool again.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'back_deal', title: 'Trade the alley for {owner.first}', icon: 'handover', talksTo: 'taker', check: check(TALK, -2), minutes: 4, onlyIf: { marks: ['wants_back'] }, authority: { concede: 'surrender_terms' },
          summary: 'You offer {taker.first} the alley once {owner.first} is out. Any hint of a setup ends {taker.his} trust in you.',
          preview: { favorable: '{taker.first} takes the alley and makes a choice about {owner.first}.', mixed: '{taker.first} agrees to the back way but keeps the handgun for now.', adverse: '{taker.first} hears a trick, and {owner.first} is the one in reach.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'The negotiator has to say it twice. Then {taker.first} nods {owner.first} toward the front, and {owner.he} {owner~goes|go}.', reveal: ['lets_go'], safe: ['owner'], mark: ['back_promised'], promise: { id: 'back_door', to: 'taker', kind: 'surrender_terms' }, moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 48 },
              courierToo('{courier.first} leaves the same way.', { if: LETS_GO }),
              { if: KEEPS, text: 'The alley suits {taker.first}, but {owner.first} still signs first.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 10 },
            ],
            mixed: [
              { if: LETS_GO, text: '{owner.first} goes out the street side. {taker.first} keeps the handgun and promises to set it down by the rear exit.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed', 'back_promised'], promise: { id: 'back_door', to: 'taker', kind: 'surrender_terms' }, moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 42 },
              courierToo('{courier.first} is first out the door.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} will take the back way, then asks for the signature on top of it.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 8 },
            ],
            adverse: escalate({
              lead: '{taker.first} decides the team only wants {taker.him} cornered out back.',
              threat: 'From the front, the team sees the handgun swing round to {owner.first}.',
              anyway: '{taker.first} stops listening and holds the handgun steady on {owner.first}, as if {owner.he} set the trap.',
              quiet: '{taker.He} {taker~hangs|hang} up and {taker~lets|let} the next three calls ring.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'alley_talk', title: 'Talk at the alley door', icon: 'radio', talksTo: 'taker', check: check(TALK, -6), minutes: 5, stress: 4, consequenceLevel: 'high', onlyIf: { marks: ['team_close'] },
          summary: '{lead} talks with {taker.first} through the gap at the back. Only the door frame shields the officer from the handgun.',
          preview: { favorable: '{taker.first} talks face to face and makes a call on {owner.first}.', mixed: '{taker.first} comes close, then backs off with {taker.his} handgun up.', adverse: 'A shot could come through the opening and hit whoever is at the gap.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'For ten minutes {taker.first} talks through the gap in the alley door. Then {taker.he} {taker~calls|call} out that {owner.first} can use the front.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 50, pressure: -10 },
              courierToo('{courier.first} goes out at {owner.first}’s side.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} speaks through the crack in the door, then walks back to the counter saying {owner.first} still owes a signature.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 12 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} sees the rest of the team behind the officer and retreats, armed and shouting. {taker.He} {taker~lets|let} {owner.first} go anyway.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'team_seen' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} is out ahead of everyone.', { if: LETS_GO }),
              { if: KEEPS, text: 'At the sight of more officers in the alley, {taker.first} retreats to {owner.first}.', reveal: ['lets_go'], moves: { taker: 'team_seen' }, next: { node: 'standoff' }, pressure: 6 },
            ],
            adverse: [{ text: '{taker.first} comes to the back shouting and fires through the gap, then bolts the door.', fire: { from: 'taker' }, moves: { taker: 'shots', others: 'shots' }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        { id: 'last_day', title: 'Ask about {taker.his} last day', icon: 'radio', talksTo: 'taker', check: check(TALK, -4), minutes: 7, onlyIf: { marks: ['knows_story'] },
          summary: '{lead} asks {taker.first} to tell the last day start to finish. {owner.first} has to hear it all again.',
          preview: { favorable: 'The whole day comes out, and then {taker.first} decides what happens to {owner.first}.', mixed: '{taker.first} stops at the moment {owner.first} accused {taker.him}.', adverse: '{taker.first} hears pity in the question, and {owner.first} takes the brunt.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} tells the day from the first customer to the till count. At the end, {owner.first} is free to go, {taker.he} {taker~says|say}.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 50, pressure: -10 },
              courierToo('{courier.first} walks out next to {owner.first}.', { if: LETS_GO }),
              { if: KEEPS, text: 'Start to finish, the day comes out. Then {taker.first} says the only ending {taker.he} {taker~wants|want} has {owner.first}’s signature under it.', reveal: ['lets_go'], moves: { taker: 'heard' }, next: { node: 'standoff' }, objective: 14 },
            ],
            mixed: [{ text: 'The story stops at the count. {owner.first} knows the rest, according to {taker.first}.', moves: { taker: 'heard' }, next: { node: 'standoff' }, objective: 8 }],
            adverse: escalate({
              lead: '{taker.first} doesn’t need anyone feeling sorry for {taker.him}, {taker.he} {taker~says|say}.',
              threat: 'Officers outside see the handgun come up at {owner.first}.',
              anyway: 'Too much has gone wrong today. {taker.He} {taker~aims|aim} over the register at {owner.first}.',
              quiet: 'After that {taker.he} {taker~goes|go} quiet and won’t pick up.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'his_door', title: 'Use the door {taker.he} unlocked', icon: 'door', talksTo: 'taker', check: check(TALK, -2), minutes: 3, onlyIf: { marks: ['door_open'] },
          summary: 'That door is unbolted because you asked. {lead} wants it used now, and a refusal would be to your face.',
          preview: { favorable: 'You get a straight answer, and the front stays unbolted.', mixed: '{taker.first} turns the bolt again, whatever happens to {owner.first}.', adverse: 'The front gets locked again, and {owner.first} could be next.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} walks {owner.first} to the front and holds the door open for {owner.him}.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 48 },
              courierToo('{courier.first} goes out after {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: 'That door is for when {owner.first} signs, according to {taker.first}, who leaves it unbolted anyway.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 10 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} lets {owner.first} out, then turns the lock behind {owner.him}, still holding the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 42 },
              courierToo('{courier.first} squeezes out just before the lock turns.', { if: LETS_GO }),
              { if: KEEPS, text: 'The front is bolted again. Nobody uses that door until {owner.first} signs.', reveal: ['lets_go'], next: { node: 'standoff' }, pressure: 4 },
            ],
            adverse: escalate({
              lead: 'The bolt goes back across.',
              threat: 'Then the handgun is trained on {owner.first}.',
              anyway: '{taker.first} has nothing to trade now and raises the handgun toward the stool.',
              quiet: 'The counter phone goes dead, unplugged at the wall.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'his_pace', title: 'Let {taker.first} set the pace', icon: 'wait', talksTo: 'taker', check: check(HOLD, -10), minutes: 30, span: 'Hours',
          summary: '{lead} stays on the line as long as {taker.first} wants. {owner.first} spends every hour of it behind the counter.',
          preview: { favorable: 'Hours pass before {taker.first} decides about {owner.first}, who may collapse first if unwell.', mixed: 'Night falls with {taker.first} still deciding. A sick {owner.first} may not hold up that long.', adverse: '{taker.first} runs out of things to say and stops answering, with {owner.first} still inside.' },
          outcomes: {
            favorable: [
              { if: [LETS_GO, OWNER_OK], text: '{taker.first} talks until the street lights come on. Then {owner.first} is told {owner.he} can go home.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 50, pressure: -8 },
              { if: [LETS_GO, OWNER_OUT], text: '{owner.first} sags off the stool two hours in and stays down. {taker.first} lets officers carry {owner.him} out and never lets go of the handgun.', reveal: ['lets_go', 'owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, mark: ['owner_down'], next: { ending: 'owner_collapsed' }, objective: 20 },
              courierToo('{courier.first} leaves with {owner.him}.', { if: LETS_GO }),
              // The owner's clock runs only where the taker would trade (s2), so a refusal never forks on it.
              { if: KEEPS, text: 'The street lights are on, and {taker.first} still wants the signature.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 10 },
            ],
            mixed: [
              { if: [LETS_GO, OWNER_OK], text: '{taker.first} lets {owner.first} go after dark, with the handgun still across {taker.his} lap.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 42, minutes: 20 },
              { if: [LETS_GO, OWNER_OUT], text: 'After dark {owner.first} stops answering when the team asks for {owner.him}. {taker.first} opens up, and two officers bring {owner.him} out gray and barely awake.', reveal: ['lets_go', 'owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, mark: ['owner_down'], next: { ending: 'owner_collapsed' }, objective: 16, minutes: 20 },
              courierToo('{courier.first} is let go an hour before {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: 'The answers get shorter as the evening wears on. {owner.first} is still in there.', reveal: ['lets_go'], next: { node: 'standoff' }, minutes: 20 },
            ],
            // A patient hold lowers the temperature: at worst the taker stops talking, never turns on
            // the owner. The owner's heart is another matter.
            adverse: [
              { if: OWNER_OK, text: 'The phone is put down. From the corner, officers can see {taker.first} sitting with {taker.his} head in {taker.his} hands, {owner.first} still by the register.', mark: ['silent'], next: { node: 'standoff' }, minutes: 10 },
              { if: OWNER_OUT, text: 'The line goes quiet. From outside, {owner.first} can be seen on the floor, not moving.', mark: ['owner_down'], next: { node: 'owner_down' }, minutes: 10 },
            ],
          } },
      ] },
    { id: 'standoff', stage: 'resolve',
      prompt: 'The bargaining has stopped. {owner.first} is perched on the stool behind the register.',
      promptIf: [
        { when: { marks: ['owner_down'] }, prompt: '{owner.first} has collapsed on the tiles. {taker.first} is screaming at someone to do something.' },
        { when: { marks: ['owner_unwell'] }, prompt: '{owner.first} is breathing hard behind the till, and {taker.first} has stopped making offers.' },
        { when: { marks: ['silent'] }, prompt: 'Every call goes unanswered. {owner.first} sits at the register within {taker.first}’s reach.' },
        { when: { marks: ['sign_demand'] }, prompt: '{taker.first} insists {owner.first} signs before anyone goes anywhere. {owner.He} {owner~waits|wait} by the cash drawer.' },
        { when: { notSafe: ['courier'] }, prompt: 'The bargaining is over. {courier.first} is still near the exit, while {owner.first} keeps to the stool.' },
        { when: GROUP_IN, prompt: '{taker.first} is done making deals. {others} {others#watches|watch} the street from beside the door.' },
      ],
      choices: [
        { id: 'into_night', title: 'Talk into the night', icon: 'wait', talksTo: 'taker', check: check(HOLD, -6), minutes: 40, span: 'All night',
          summary: '{lead} rings back through the night. If {taker.first} never gives in, {owner.first} spends it at the counter.',
          preview: { favorable: '{taker.first} gives up on the signature, if {owner.first} lasts the night.', mixed: 'Near midnight {owner.first} is let out, and the handgun stays with {taker.first}. An ailing {owner.first} may have collapsed by then.', adverse: '{taker.first} stops answering for good, and {owner.first} could be in the worst danger yet.' },
          outcomes: {
            favorable: [
              { if: OWNER_OK, text: 'A call comes back after midnight, and {taker.first} sounds worn out. {owner.first} gets to walk out unsigned.', reveal: ['owner_faint'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              { if: OWNER_OUT, text: 'After midnight, {owner.first} lies collapsed by the till. {taker.first} unbolts the door so officers can bring {owner.him} to the medic.', reveal: ['owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, mark: ['owner_down'], next: { ending: 'owner_collapsed' }, objective: 18 },
              courierToo('{courier.first} walks out with {owner.him}.'),
            ],
            mixed: [
              { if: OWNER_OK, text: 'Before midnight, {owner.first} is allowed out. The handgun and the receiver stay with {taker.first}.', reveal: ['owner_faint'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 35, minutes: 20 },
              { if: OWNER_OUT, text: 'By midnight {owner.first} can’t sit up. {taker.first} lets the team in for {owner.him} but won’t give up the handgun.', reveal: ['owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, mark: ['owner_down'], next: { ending: 'owner_collapsed' }, objective: 14, minutes: 20 },
              courierToo('{courier.first} gets released first.'),
            ],
            adverse: [
              { text: 'The line goes silent and stays that way.', pressure: 10 },
              { if: [RAISED, OWNER_OK], text: 'From the corner window, officers see {taker.first} take the handgun to {owner.first}.', reveal: ['raised'], next: { node: 'threat' } },
              { if: [CALM, BREAKING, OWNER_OK], text: 'Then {taker.first} snaps, and the handgun is aimed at {owner.first}.', mark: ['turned'], next: { node: 'threat' } },
              // A clock that has run out stays out, so OWNER_OK also means the owner is still on the stool.
              { if: [CALM, HOLDING, OWNER_OK], when: { safe: ['courier'] }, text: 'Command keeps the block shut through the night.', reveal: ['raised'], next: { ending: 'held_inside' } },
              { if: [CALM, HOLDING, OWNER_OK], when: { notSafe: ['courier'] }, text: '{courier.first} spends the night on those boxes too.', reveal: ['raised'], next: { ending: 'held_both' } },
              { if: OWNER_OUT, text: 'In the night, {owner.first} collapses out of sight. Nobody inside answers the team.', mark: ['owner_down'], next: { node: 'owner_down' } },
            ],
          } },
        { id: 'read_back', title: 'Read {taker.his} account back', icon: 'handover', talksTo: 'taker', check: check(TALK, -2), minutes: 8, onlyIf: { marks: ['account'], notMarks: ['owner_down'] },
          summary: '{lead} reads back every line on the pad. {owner.first} hears it too, with {taker.first} standing over {owner.him}.',
          preview: { favorable: '{taker.first} hears {taker.his} own words and lets the signature go.', mixed: '{taker.first} corrects the account line by line while {owner.first} waits.', adverse: '{taker.first} hears a line {taker.he} never said and may turn on {owner.first} for it.' },
          outcomes: {
            favorable: [
              { text: 'The whole account gets read without a word from {taker.first}. Then {taker.he} {taker~says|say} that will do, and {owner.first} leaves unsigned.', safe: ['owner'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} leads the way out.'),
            ],
            mixed: [
              { text: 'The reading stops four times while {taker.first} fixes a word. When it is right, {owner.first} can go, but the handgun stays.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 38, minutes: 6 },
              courierToo('{courier.first} gets the door first.'),
            ],
            adverse: [
              { text: '“That’s not what I said,” {taker.first} shouts.', moves: { taker: 'provoked' }, pressure: 12 },
              { if: RAISED, text: 'Officers at the window watch {taker.him} wheel on {owner.first}, handgun out.', reveal: ['raised'], next: { node: 'threat' } },
              { if: [CALM, BREAKING], text: '{taker.He} {taker~has|have} had enough of being misheard and {taker~points|point} at {owner.first}.', mark: ['turned'], next: { node: 'threat' } },
              ...heldEnd({ if: [CALM, HOLDING], text: '{taker.He} {taker~hangs|hang} up before the next line.', reveal: ['raised'] },
                '{courier.first} is still waiting on the boxes.', '{owner.first} has slid off the stool and isn’t getting up.')
                .map((outcome, i) => i === 0 ? outcome : { ...outcome, if: [CALM, HOLDING] }),
            ],
          } },
        { id: 'pull_back', title: 'Pull back to the corner', icon: 'handover', check: check(MOVE, -20), minutes: 2,
          summary: 'Your squad falls back a block, and the call ends there. {owner.first} is left with {taker.first}.',
          preview: { favorable: 'You hold the corner, and {owner.first} remains inside.', mixed: 'From the corner, you keep the block shut. {owner.first} stays with {taker.first}.', adverse: 'You give up the glass and nobody gets {owner.first} out.' },
          outcomes: {
            favorable: heldEnd({ text: 'The team withdraws to the corner. {owner.first} remains at the till.', objective: 5 },
              '{courier.first} is in there too, on the boxes.', 'Nobody reaches {owner.first}, who is down on the tiles.'),
            mixed: heldEnd({ text: 'Officers fall back and close the block. Inside, {taker.first} hasn’t let {owner.first} go.', objective: 5 },
              'So is {courier.first}, by the entrance.', '{owner.first} hasn’t gotten up.'),
            adverse: heldEnd({ text: 'The team gives up the windows and holds the cross street.', objective: 5 },
              '{courier.first} is stuck in there as well.', 'Behind the till, {owner.first} lies where {owner.he} fell.'),
          } },
      ] },
    { id: 'threat', stage: 'resolve',
      prompt: '{owner.first} is at the till, close enough for {taker.first} to grab.',
      promptIf: [
        { when: { marks: ['owner_down'] }, prompt: '{owner.first} is down, and {taker.first} stands over {owner.him}, armed.' },
        { when: { notSafe: ['courier'] }, prompt: 'The handgun is pointed at {owner.first}. {courier.first} is pressed against the stacked boxes.' },
        { when: GROUP_IN, prompt: '{owner.first} is pinned against the counter by {taker.first}. {others} {others#has|have} backed against the shelves.' },
        { when: { marks: ['team_close'] }, prompt: '{owner.first} is staring at what {taker.first} is holding. Your squad is a few steps away.' },
      ],
      choices: [
        { id: 'talk_down', title: 'Talk {taker.him} down', icon: 'radio', talksTo: 'taker', check: check(TALK, 6), minutes: 3, stress: 4, consequenceLevel: 'high', onlyIf: { notMarks: ['owner_down'] },
          modifiers: [{ label: 'You know how that day went', mark: 'knows_story', value: 6 }],
          summary: '{lead} calls to {taker.first} from the glass, in plain view and in line with the handgun.',
          preview: { favorable: 'The handgun is set down, and {owner.first} walks out ahead of {taker.first}.', mixed: '{owner.first} gets out, and {taker.first} stays armed.', adverse: 'Whoever stands at the glass may be hit if {taker.first} fires.' },
          outcomes: {
            favorable: [
              { text: '{taker.first} leaves the handgun next to the register and lets {owner.first} out first. {taker.He} {taker~follows|follow} on the team’s word into the hands of two officers by the step.', safe: ['owner'], moves: { taker: 'released' }, ...surrender('everyone_out'), objective: 75, pressure: -12 },
              courierToo('{courier.first} is already on the sidewalk.'),
            ],
            mixed: [
              { text: '{owner.first} gets out the front door. {taker.first} backs away from the window, the handgun still up.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} is out before {owner.him}.'),
            ],
            adverse: [{ text: 'A shot goes through the window as {taker.first} spins around. {owner.first} is still inside.', fire: { from: 'taker' }, moves: { taker: 'shots', others: 'shots' }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        { id: 'go_in', title: 'Send the team in', icon: 'shield', check: check(ENTER, 8), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'Your squad is already close', mark: 'team_close', value: 8 }, { label: 'Spare key in hand', mark: 'spare_key', value: 8 }, { label: 'Front door unbolted', mark: 'door_open', value: 6 }],
          summary: '{owner.first} could be badly hurt or die when the door opens. {lead} keeps {taker.first} busy at the window.',
          preview: { favorable: 'You reach {owner.first} and get {owner.him} out.', mixed: '{owner.first} is out, hurt on the way.', adverse: '{taker.first} turns on {owner.first} as you come in. Either of them can be badly hurt, and {owner.first} could die.' },
          outcomes: {
            favorable: [
              { when: { notMarks: ['owner_down'] }, text: 'The team is through the door before {taker.first} turns. {owner.first} is out on the sidewalk, and the team has {taker.first}, the handgun out of reach.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'entry_clean' }, objective: 50 },
              { when: { marks: ['owner_down'] }, text: 'Officers reach the counter before {taker.first} can turn and lift {owner.first} off the floor. {taker.first} ends up face down, empty-handed.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'went_in_for_owner' }, objective: 45 },
              courierToo('{courier.first} goes out ahead of {owner.him}.'),
              { when: GROUP, text: '{others} {others#lies|lie} down without being told.' },
            ],
            mixed: [
              { when: { notMarks: ['owner_down'] }, text: '{owner.first} falls hard against the counter as the team pulls {owner.him} clear. The medic at the curb checks {owner.his} arm, and {taker.first} is taken.', safe: ['owner'], harm: { owner: 'wounded' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 35 },
              { when: { marks: ['owner_down'] }, text: '{taker.first} grapples with the first officer over {owner.first}. The team gets {owner.first} out, and that officer comes away hurt.', safe: ['owner'], officer: 'wounded', out: ['taker', 'others'], next: { ending: 'went_in_for_owner' }, objective: 38 },
              courierToo('{courier.first} is out first.'),
            ],
            adverse: [
              { if: LETS_GO, when: { notMarks: ['owner_down'] }, text: '{taker.first} hauls {owner.first} low behind the register as the door gives. {owner.first} hits the floor hard, and {taker.first} lets go when the team reaches them.', reveal: ['lets_go'], safe: ['owner'], harm: { owner: 'serious' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
              { if: LETS_GO, when: { marks: ['owner_down'] }, text: '{taker.first} stands over {owner.first} and fires once at the door before the team gets there. Officers haul {owner.first} out over the counter.', reveal: ['lets_go'], safe: ['owner'], out: ['taker', 'others'], fire: { from: 'taker' }, next: { ending: 'went_in_for_owner' }, objective: 25 },
              { if: KEEPS, text: '{taker.first} fires at {owner.first} when the door swings in, then turns toward the team.', reveal: ['lets_go'], harm: { owner: 'fatal' }, out: ['others'], force: { on: 'taker', next: { hurt: { ending: 'owner_killed_taker_hurt' }, none: { ending: 'owner_killed' } }, noFatal: true }, objective: 5 },
              { if: KEEPS, text: '', fire: { from: 'taker' } },
              courierToo('{courier.first} slips away in the struggle.'),
            ],
          } },
        { id: 'step_back', title: 'Clear out of sight', icon: 'wait', check: check(HOLD, -2), minutes: 8,
          summary: 'Everyone steps out of {taker.first}’s sight, leaving nobody to aim at, and nobody near enough to help {owner.first}.',
          preview: { favorable: 'With nobody in view, the handgun comes down.', mixed: '{taker.first} puts the handgun down but won’t release {owner.first}.', adverse: 'The handgun stays where it is, and nobody is close by if {taker.first} hurts {owner.first}.' },
          outcomes: {
            favorable: [
              { when: { notMarks: ['owner_down'] }, text: 'With the street empty, {taker.first} picks up the phone and releases {owner.first}.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              { when: { marks: ['owner_down'] }, text: 'Once nobody is in sight, {taker.first} opens the door for the medic, and the team lifts {owner.first} out.', safe: ['owner'], next: { ending: 'owner_collapsed' }, objective: 20 },
              courierToo('{courier.first} leaves the shop with {owner.him}.'),
            ],
            mixed: heldEnd({ text: 'The handgun drops to {taker.first}’s side, but {owner.first} isn’t let go. The block stays sealed.', objective: 15 },
              '{courier.first} stays put on the boxes.', 'Nobody inside helps {owner.first} up.'),
            adverse: [
              ...heldEnd({ if: LETS_GO, text: 'From the corner, the team can see {owner.first} still in the handgun’s path.', reveal: ['lets_go'], pressure: 8 },
                '{courier.first} has {courier.his} back to the wall by the door.', '{owner.first} is down, and {taker.first} is standing over {owner.him}.')
                .map((outcome, i) => i === 0 ? outcome : { ...outcome, if: LETS_GO }),
              { if: KEEPS, text: 'By the time the team looks again, {owner.first} has signed, struck with the handgun until {owner.he} did. {taker.first} sends {owner.him} out and keeps the page.', reveal: ['lets_go'], safe: ['owner'], harm: { owner: 'serious' }, next: { ending: 'owner_beaten' }, objective: 10, pressure: 10 },
              courierToo('{courier.first} is sent out the front.', { if: KEEPS }),
            ],
          } },
      ] },
    { id: 'fired_on', stage: 'resolve',
      prompt: 'A shot has been fired. {owner.first} is still at the counter.',
      promptIf: [
        { when: { marks: ['owner_down'] }, prompt: 'After the shot, {owner.first} still lies behind the till, within {taker.first}’s reach.' },
        { when: { notSafe: ['courier'] }, prompt: 'Since the shot, neither {owner.first} nor {courier.first} has come out.' },
      ],
      choices: [
        { id: 'go_in', title: 'Go in now', icon: 'shield', check: check(ENTER, 12), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'Officers are already at the door', mark: 'team_close', value: 8 }, { label: 'The landlord’s key works', mark: 'spare_key', value: 8 }, { label: 'The bolt is open', mark: 'door_open', value: 6 }],
          summary: 'Your squad goes in at someone who just fired. {owner.first} could die, and an officer could be hit.',
          preview: { favorable: 'You get to {owner.first} first and bring {owner.him} out.', mixed: 'You bring {owner.first} out with an injury.', adverse: '{taker.first} meets you at the till, armed. {owner.first} may not survive the entry, and {taker.first} may be hurt too.' },
          outcomes: {
            favorable: [
              { when: { notMarks: ['owner_down'] }, text: 'Officers get there before {taker.first} can swing around. {owner.first} is hustled out to the street, and {taker.first} ends up prone with empty hands.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'entry_clean' }, objective: 50 },
              { when: { marks: ['owner_down'] }, text: 'Officers are over the counter with {taker.first} still looking the other way. Two of them carry {owner.first} out, and {taker.first} lets the handgun fall.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'went_in_for_owner' }, objective: 45 },
              courierToo('{courier.first} is already outside.'),
              { when: GROUP, text: '{others} {others#shows|show} officers {others.his} empty hands.' },
            ],
            mixed: [
              { when: { notMarks: ['owner_down'] }, text: '{owner.first} goes down against the shelves in the rush and comes out holding {owner.his} arm. Officers hold {taker.first}.', safe: ['owner'], harm: { owner: 'wounded' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 35 },
              { when: { marks: ['owner_down'] }, text: 'An officer is hurt pulling {taker.first} back from the till. Two more officers bring {owner.first} out to the ambulance.', safe: ['owner'], officer: 'wounded', out: ['taker', 'others'], next: { ending: 'went_in_for_owner' }, objective: 38 },
              courierToo('{courier.first} beats everyone outside.'),
            ],
            adverse: [
              { if: LETS_GO, when: { notMarks: ['owner_down'] }, text: '{taker.first} drags {owner.first} to the floor as officers come in. {owner.first} is badly hurt when they pull {owner.him} free, and {taker.first} surrenders.', reveal: ['lets_go'], safe: ['owner'], harm: { owner: 'serious' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
              { if: LETS_GO, when: { marks: ['owner_down'] }, text: 'A second shot comes through the door as officers go in. They reach {owner.first} where {owner.he} {owner~lies|lie} and carry {owner.him} away while others take {taker.first}.', reveal: ['lets_go'], safe: ['owner'], out: ['taker', 'others'], fire: { from: 'taker' }, next: { ending: 'went_in_for_owner' }, objective: 25 },
              { if: KEEPS, text: '{taker.first} fires again, this time at {owner.first}, then swings toward the door.', reveal: ['lets_go'], harm: { owner: 'fatal' }, out: ['others'], force: { on: 'taker', next: { hurt: { ending: 'owner_killed_taker_hurt' }, none: { ending: 'owner_killed' } }, noFatal: true }, objective: 5 },
              { if: KEEPS, text: '', fire: { from: 'taker' } },
              courierToo('{courier.first} crawls out the door in the noise.'),
            ],
          } },
        { id: 'hold_corner', title: 'Regroup and call {taker.him}', icon: 'wait', talksTo: 'taker', check: check(HOLD), minutes: 10,
          summary: 'You regroup behind cover and call the shop. {owner.first} stays inside with someone who has just fired.',
          preview: { favorable: 'You get an answer, and {owner.first} goes free.', mixed: '{taker.first} talks but keeps {owner.first} there.', adverse: 'No answer comes, and {owner.first} stays in there with {taker.him}.' },
          outcomes: {
            favorable: [
              { when: { notMarks: ['owner_down'] }, text: 'On the fourth call {taker.first} picks up and says {taker.he} didn’t mean to fire. {owner.first} can go.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 35 },
              { when: { marks: ['owner_down'] }, text: 'Eventually {taker.first} lets two officers in to carry {owner.first} out.', safe: ['owner'], next: { ending: 'owner_collapsed' }, objective: 18 },
              courierToo('{courier.first} comes out alongside {owner.him}.'),
            ],
            mixed: heldEnd({ text: '{taker.first} picks up but won’t let {owner.first} go. The street stays shut.', objective: 8 },
              '{courier.first} is crouched by the boxes.', 'Nobody has reached {owner.first} on the floor.'),
            adverse: heldEnd({ text: 'The phone rings out every time, and the street stays sealed off.', pressure: 6 },
              'Nobody has let {courier.first} out either.', '{owner.first} hasn’t moved since the shot.'),
          } },
      ] },
    { id: 'owner_down', stage: 'resolve',
      prompt: '{owner.first} is down behind the counter, not answering. A medic waits at the corner for your word.',
      choices: [
        { id: 'medic_door', title: 'Get the medic to {owner.first}', icon: 'radio', talksTo: 'taker', check: check(TALK, -4), minutes: 3,
          summary: '{lead} wants {taker.first} to unbolt the front for the medic. Two officers will fetch {owner.first} only if {taker.he} {taker~does|do}.',
          preview: { favorable: 'The bolt comes back, and {owner.first} is carried out.', mixed: '{owner.first} is brought out while {taker.first} watches, armed.', adverse: '{taker.first} won’t open, and {owner.first} lies there untreated.' },
          outcomes: {
            favorable: [
              { text: '{taker.first} slides the bolt and steps back from the door, the handgun on the counter behind {taker.him}. Two officers lift {owner.first} onto a stretcher.', safe: ['owner'], moves: { taker: 'released' }, next: { ending: 'owner_collapsed' }, objective: 25 },
              courierToo('{courier.first} comes out behind the stretcher.'),
            ],
            mixed: [
              { text: 'The door opens a crack. Officers reach {owner.first} while {taker.first} watches them, armed.', safe: ['owner'], moves: { taker: 'released' }, next: { ending: 'owner_collapsed' }, objective: 20 },
              courierToo('{courier.first} squeezes out past the officers.'),
            ],
            adverse: [
              { text: '{taker.first} thinks the medic is a trick and keeps the door shut. {owner.first} lies still.', objective: 5 },
              { when: { safe: ['courier'] }, text: '', next: { ending: 'owner_left_down' } },
              { when: { notSafe: ['courier'] }, text: 'Nobody has gotten {courier.first} out either.', next: { ending: 'held_both_down' } },
            ],
          } },
        { id: 'go_in', title: 'Go in for {owner.first}', icon: 'shield', check: check(ENTER, 4), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'A key to the front', mark: 'spare_key', value: 8 }, { label: 'The front is unbolted', mark: 'door_open', value: 6 }],
          summary: '{lead} takes your squad in for {owner.first}. {taker.first} is armed, and anyone at that counter can be hurt.',
          preview: { favorable: 'Your squad gets to {owner.first}, and {taker.first} gives up the handgun.', mixed: 'Officers get {owner.first} out, but one of them is hurt in the scramble.', adverse: '{taker.first} fights you at the counter and may end up badly hurt. An officer can be hit.' },
          outcomes: {
            favorable: [
              { text: 'Officers reach the register fast. {taker.first} drops the handgun, and {owner.first} goes out to the medic on a stretcher.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'went_in_for_owner' }, objective: 45 },
              courierToo('{courier.first} reaches the street first.'),
            ],
            mixed: [
              { text: 'An officer twists a knee vaulting the counter. {owner.first} gets to the ambulance, and {taker.first} is walked out between two officers.', safe: ['owner'], officer: 'wounded', out: ['taker', 'others'], next: { ending: 'went_in_for_owner' }, objective: 38 },
              courierToo('{courier.first} gets out ahead of the stretcher.'),
            ],
            adverse: [
              { text: '{taker.first} fires toward the entrance and grabs for {owner.first} as the team comes over the counter. Officers drag {owner.first} clear.', safe: ['owner'], out: ['others'], force: { on: 'taker', next: { hurt: { ending: 'went_in_taker_hurt' }, none: { ending: 'went_in_for_owner' } }, noFatal: true }, objective: 30 },
              { text: '', fire: { from: 'taker' } },
              courierToo('{courier.first} runs for the street.'),
            ],
          } },
      ] },
    { id: 'last_one', stage: 'resolve',
      prompt: '{courier.first} and {owner.first} are outside with patrol. Behind the counter, {taker.first} is alone.',
      promptIf: [
        { when: GROUP_IN, prompt: '{owner.first} and {courier.first} are clear. {others} {others#is|are} still beside {taker.first}.' },
        { when: { marks: ['still_armed'] }, prompt: 'Both people {taker.first} held are clear, and {taker.he} {taker~has|have} the handgun by the register.' },
      ],
      choices: [
        { id: 'out_front', title: 'Talk {taker.him} out the front', icon: 'radio', talksTo: 'taker', check: check(TALK, 8), minutes: 6, onlyIf: { notMarks: ['back_promised'] },
          modifiers: [{ label: '{taker.He} still {taker~has|have} the handgun', mark: 'still_armed', value: -8 }, { label: 'You heard the whole story', mark: 'knows_story', value: 4 }],
          summary: '{lead} tells {taker.first} how to come out, hands open, past the street and every phone at the tape.',
          preview: { favorable: '{taker.first} walks out the front with empty hands.', mixed: '{taker.first} stalls in the doorway with the street watching, then comes out.', adverse: '{taker.first} won’t walk out where the street can see, and stays at the counter.' },
          outcomes: {
            favorable: [{ text: '{taker.first} steps through the front door with {taker.his} hands open, the way the team tells {taker.him}. Officers take {taker.him} by the arms.', ...surrender('everyone_out'), objective: 30 }],
            mixed: [{ text: '{taker.first} stands inside the glass for twenty minutes, then steps out past a row of phones at the tape. Two officers walk {taker.him} to the car.', ...surrender('everyone_out'), objective: 25, minutes: 15 }],
            adverse: [{ text: '{taker.first} isn’t walking out in front of everyone, {taker.he} {taker~says|say}, and sits back down at the register.', next: { ending: 'taker_held' }, objective: 5 }],
          } },
        { id: 'out_back', title: 'Bring {taker.him} out the back', icon: 'door', talksTo: 'taker', check: check(TALK, -4), minutes: 5, onlyIf: { marks: ['wants_back'] }, authority: { concede: 'surrender_terms' },
          modifiers: [{ label: 'The handgun is still in reach', mark: 'still_armed', value: -8 }],
          summary: '{lead} brings {taker.first} out the rear, away from any camera. The alley leaves little room for a change of mind.',
          preview: { favorable: '{taker.first} steps into the alley with nothing in {taker.his} hands.', mixed: '{taker.first} hesitates at the rear, then comes out.', adverse: '{taker.first} stops in the back doorway and goes back inside.' },
          outcomes: {
            favorable: [{ text: '{taker.first} comes out the alley door with open hands and asks the team not to let the street see {taker.him}. The team has {taker.him} before the corner.', ...surrender('out_the_back'), objective: 32 }],
            mixed: [{ text: '{taker.first} gives up in the alley, hands empty, but a neighbor at the far end has a phone up.', ...surrender('out_the_back'), objective: 26 }],
            adverse: [{ text: 'At the doorway {taker.first} backs inside again and bolts the rear exit.', next: { ending: 'taker_held' } }],
          } },
        { id: 'let_him_sit', title: 'Let {taker.him} decide', icon: 'wait', check: check(HOLD, -14), minutes: 45, span: 'All night',
          summary: 'Command keeps the street closed while {taker.first} decides when to come out. Your squad stays on the corner until then.',
          preview: { favorable: '{taker.first} calls out that {taker.he} {taker~is|are} coming out.', mixed: 'The door opens near dawn.', adverse: 'The shift ends and {taker.first} hasn’t come out.' },
          outcomes: {
            favorable: [{ text: '{taker.first} shouts through the door that {taker.he} {taker~is|are} done. {taker.He} {taker~walks|walk} to the team with {taker.his} palms showing.', ...surrender('out_by_dawn'), objective: 28 }],
            mixed: [{ text: 'As the sky gets light, {taker.first} unlocks the front and gives {taker.himself} up.', ...surrender('out_by_dawn'), objective: 24, minutes: 30 }],
            adverse: [{ text: 'When the shift changes, {taker.first} hasn’t moved from the counter.', next: { ending: 'taker_held' } }],
          } },
      ] },
    // Only after a surrender that split the group (the cascade's `some`): part of the group came out.
    { id: 'stayed_behind', stage: 'resolve',
      prompt: '{taker.first} and part of {taker.his} old shift are in custody. Whoever stayed is behind the till.',
      choices: [
        { id: 'call_rest', title: 'Call the others out', icon: 'radio', talksTo: 'others', check: check(TALK, -4), minutes: 5,
          summary: '{lead} calls each name left inside, one at a time. Whoever stayed has just watched {taker.first} walk out without them.',
          preview: { favorable: 'One by one, the stragglers come to the door.', mixed: 'They come out, after one of them argues at the door.', adverse: 'Nobody else comes, and the shop goes dark.' },
          outcomes: {
            favorable: [{ text: 'The ones still inside come out with open palms, single file, and the team takes them.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 20 }],
            mixed: [{ text: 'One of them shouts that they only came here to vouch for a friend. Then the last of them walk out.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 16 }],
            adverse: [{ text: 'Someone inside switches off the lights. Nobody else comes to the door.', next: { ending: 'stayers_held' } }],
          } },
        { id: 'wait_rest', title: 'Wait for the rest', icon: 'wait', check: check(HOLD, -10), minutes: 30, span: 'Hours',
          summary: 'Your squad holds the corner and lets whoever stayed come out when they are ready. That could take all night.',
          preview: { favorable: 'Before morning, the rest walk out.', mixed: 'The rest appear at first light.', adverse: 'Morning comes with someone still inside.' },
          outcomes: {
            favorable: [{ text: 'A few hours on, the remaining ones walk out, hands empty.', out: ['others'], next: { ending: 'group_out' }, objective: 16 }],
            mixed: [{ text: 'At first light the front door opens, and the last of the shift come out squinting.', out: ['others'], next: { ending: 'group_out_dawn' }, objective: 12, minutes: 20 }],
            adverse: [{ text: 'By morning the shop is still dark, with someone in it.', next: { ending: 'stayers_held' } }],
          } },
      ] },
    // Only after a surrender nobody followed (the cascade's `none`).
    { id: 'nobody_followed', stage: 'resolve',
      prompt: '{taker.first} walked out alone. {others} {others#is|are} still in there, and nobody is talking.',
      choices: [
        { id: 'call_others', title: 'Call them out by name', icon: 'radio', talksTo: 'others', check: check(TALK, -2), minutes: 5,
          summary: '{lead} names {others} and says {taker.first} is out unhurt. A voice from the street may not be enough.',
          preview: { favorable: '{others} {others#appears|appear} at the door.', mixed: 'After asking twice about {taker.first}, {others} {others#steps|step} out.', adverse: '{others} {others#remains|remain} out of sight, and the lights go off.' },
          outcomes: {
            favorable: [{ text: '{others} {others#walks|walk} out together, palms showing, and officers take {others.him} aside.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 20 }],
            mixed: [{ text: '{others.first} asks whether {taker.first} is hurt before anyone moves. Then {others.he} {others~heads|head} for the door.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 16 }],
            adverse: [{ text: 'The shop lights go off. {others} {others#doesn’t|don’t} answer.', next: { ending: 'stayers_held' } }],
          } },
        { id: 'give_night', title: 'Give them the night', icon: 'wait', check: check(HOLD, -10), minutes: 30, span: 'Hours',
          summary: 'You keep the street sealed and leave {others} to decide. Your squad stays until the door opens.',
          preview: { favorable: '{others} {others#gives|give} up before morning.', mixed: '{others} {others#emerges|emerge} at dawn.', adverse: 'Daylight finds {others} still inside.' },
          outcomes: {
            favorable: [{ text: 'Hours later the door opens, and {others} {others#surrenders|surrender} to the team.', out: ['others'], next: { ending: 'group_out' }, objective: 16 }],
            mixed: [{ text: 'As the light comes up, {others} {others#shuffles|shuffle} onto the sidewalk.', out: ['others'], next: { ending: 'group_out_dawn' }, objective: 12, minutes: 20 }],
            adverse: [{ text: 'Dawn comes with {others} still behind the counter.', next: { ending: 'stayers_held' } }],
          } },
      ] },
  ],
  endings: {
    everyone_out: { title: 'Everyone walked out', disposition: 'resolved',
      summary: '{courier.first} and {owner.first} are safe outside. {taker.first} is with the team now, and what happens next is not this call’s to decide. {courier.first} still has the unsigned delivery slip.' },
    out_the_back: { title: 'Out the back', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} got out. {taker.first} left by the alley, away from the crowd at the tape, and is in custody.' },
    out_by_dawn: { title: 'Out by morning', disposition: 'resolved',
      summary: '{courier.first} and {owner.first} have been outside for hours. {taker.first} came out after a long night and is in the team’s hands. {place} won’t open today.' },
    group_out: { title: 'The last shift came out', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} came through unhurt. Officers have {taker.first}, and {others} too.' },
    group_out_dawn: { title: 'Out with the daylight', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} left hours ago. By morning {taker.first} and everyone who came with {taker.him} are with the team.' },
    entry_clean: { title: 'Out through an entry', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} are on the sidewalk, unhurt, and officers have {taker.first}. {owner.first} won’t go back behind the counter tonight.' },
    entry_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{owner.first} is getting care at the curb, hurt in the entry. {courier.first} is safe. Officers are holding {taker.first}. {owner.first} asks someone to lock up for {owner.him}.' },
    went_in_for_owner: { title: 'Carried out', disposition: 'resolved',
      summary: 'The team went in for {owner.first}, who is in the ambulance now. {courier.first} is unhurt. {taker.first} was taken without a scratch.' },
    went_in_taker_hurt: { title: 'Carried out, both of them', disposition: 'resolved',
      summary: '{taker.first} took the worst of it, and a medic is with {taker.him}. {owner.first} went in a second ambulance. {courier.first} is safe on the sidewalk.' },
    owner_killed: { title: '{owner.He} didn’t come out', disposition: 'relief_partial',
      summary: '{owner.first} died at {owner.his} own counter. Officers hold {taker.first}, who isn’t hurt. {courier.first} is sitting in the patrol car with the slip nobody signed.' },
    owner_killed_taker_hurt: { title: 'Two carried out', disposition: 'relief_partial',
      summary: '{taker.first} is hurt, and the crew is working on {taker.him}. {owner.first} died before the team reached {owner.him}. {courier.first} is safe in a patrol car now.' },
    owner_collapsed: { title: '{owner.He} collapsed at the counter', disposition: 'relief_partial', remainingTasks: ['Talk {taker.first} out from behind the counter'],
      summary: '{owner.first} went out on a stretcher after collapsing at the till. {courier.first} came out safe. {taker.first} stayed inside, still armed.' },
    owner_left_down: { title: 'Still on the floor', disposition: 'relief_partial', remainingTasks: ['Get {owner.first} to the medic', 'Bring {taker.first} out of there alive'],
      summary: '{owner.first} is lying on the shop floor near {taker.first}. The medic is waiting at the corner, and command holds the block.' },
    owner_beaten: { title: '{owner.He} signed', disposition: 'relief_partial', remainingTasks: ['Get {taker.first} to put the handgun down'],
      summary: 'Medics have {owner.first}, hurt, and {owner.his} name is on the statement. {courier.first} is safe. {taker.first} has the page and hasn’t come out.' },
    taker_held: { title: 'Behind the counter', disposition: 'relief_partial', remainingTasks: ['Talk {taker.first} out of the shop'],
      summary: '{courier.first} and {owner.first} are out of harm’s way. {taker.first} is holding out behind the counter with the handgun, and patrol keeps the street shut.' },
    stayers_held: { title: 'Someone stayed', disposition: 'relief_partial', remainingTasks: ['Talk the rest of that shift outside'],
      summary: '{owner.first} and {courier.first} made it out, and {taker.first} is in custody. Not everyone who came in with {taker.him} has come out, and the block stays closed.' },
    held_inside: { title: 'Still inside at the counter', disposition: 'relief_partial', remainingTasks: ['Get {owner.first} off the shop floor', 'Bring everyone else out alive'],
      summary: 'Command holds the street, with the team at the perimeter. {owner.first} is still in the shop with {taker.first} and the handgun.' },
    held_both: { title: 'Both still inside', disposition: 'relief_partial',
      remainingTasks: ['Walk {courier.first} out to patrol', 'Get {owner.first} off that stool', 'Talk {taker.first} into putting the handgun down'],
      summary: 'Patrol has the block sealed. {courier.first} and {owner.first} are both still in there with {taker.first}, who is armed.' },
    held_both_down: { title: 'Both still inside', disposition: 'relief_partial',
      remainingTasks: ['Get a medic to {owner.first}', 'Bring {courier.first} out from the boxes', 'Talk {taker.first} into setting the handgun aside'],
      summary: 'The street stays closed. {owner.first} has collapsed inside, and {courier.first} is still on the boxes, a few steps from {taker.first}.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get everyone out safely'],
      summary: 'Command still holds the street, and the call is still open. The team has no step left that it can take from here.' },
  },
  rewards: { funding: 2600, devPoints: 3, trust: 6, xp: 45 },
  squads: { min: 1, max: 3 },
};
