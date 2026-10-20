import type { CallTree, TreeChoice, TreeIf, TreeNext, TreeOutcome } from './types';

// One Last Signature, the M2 slice 5 pilot (design sheet: docs/calls/hostage-signature-design.md).
// A fired employee holds the owner who called them a thief (a victim, the target of the grievance)
// and a courier who walked in for a signature (an incidental hostage). One or two coworkers from the
// last shift may have come with them, to back a story, not to hold anyone: a counted group
// (`others`) whose text sits behind count conditions and whose members follow the taker's surrender
// by the cascade.
//
// Hidden truth: whether the taker trades the owner for a written account (lets_go), and whether a
// refusal turns the handgun on the owner (raised). Each situation also reframes the till (the depth
// redesign, docs/calls/hostage-signature-design.md "Depth redesign"): in the first the owner found
// the money that night and never said so (owner_wrong), in the second the owner is covering for
// a kid who closed out the drawer, and in the third the taker took it and the page is the story
// he tells himself (took_it). "Ask her. She knows." is true in all three. Stage 3 escalation reads the meters too: the
// truth decides, or a taker past breaking point does it anyway (mark `turned`, a threat mark). In
// the second situation the owner's heart is a clock: the long holds fork on it, and anywhere else it
// runs out its `onOut` records the collapse and moves the call to `owner_down`; a held ending reads
// the clock itself (heldEnd), since an ending the decision reached stands.
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
const TREAT = { kind: 'medical', ratings: [{ key: 'medical', weight: 0.7 }, { key: 'composure', weight: 0.3 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
const check = (base: typeof TALK | typeof HOLD | typeof ASK | typeof MOVE | typeof TREAT | typeof ENTER, difficulty = 0): TreeChoice['check'] =>
  ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

/** Group conditions: text and choices that name the others exist only in calls that have them. */
const GROUP = { count: { role: 'others', min: 1 } } as const;
const GROUP_IN = { count: { role: 'others', min: 1 }, notMarks: ['others_out'] };
const LONE = { count: { role: 'others', max: 0 } } as const;

/** The lie (dilemma pattern 15): the team told the taker the owner would sign. Any of the page and
 * door choices at the counter can bring the owner to the phone to say it, and on an adverse result
 * the taker hears that the promise was empty. */
const foundOut = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { marks: ['lied_sign'] }, breaks: ['will_sign'], mark: ['lie_found'], moves: { taker: 'provoked' }, text, ...extra });

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

/** A crisis negotiator on the call: talk choices that turn on the words go better (owner 2026-10-20). */
const NEGOTIATOR = { cert: 'crisis_negotiation', value: 6, label: 'Negotiation training' } as const;

/** The courier goes out with the owner when still inside. */
const courierToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['courier'] }, text, safe: ['courier'], ...extra });

/** The call ends with the owner still inside. `lead` is the line either way; `courierLine` is added
 * while the courier is inside and `downLine` when the owner's clock runs out in this decision (the
 * ending stands, R-G4 rule 1, so the text says the collapse here), and the ending follows both:
 * held_inside, held_both, owner_left_down or held_both_down. `also` are the conditions the band puts
 * on the held branch (the truth or the taker's meters), added to every outcome after the lead. */
const heldEnd = (lead: TreeOutcome, courierLine: string, downLine: string, also: TreeIf[] = []): TreeOutcome[] => [
  lead,
  { ...(also.length ? { if: also } : {}), when: { notSafe: ['courier'] }, text: courierLine },
  { if: [...also, OWNER_OUT], text: downLine },
  { if: [...also, OWNER_OK], when: { safe: ['courier'] }, text: '', next: { ending: 'held_inside' } },
  { if: [...also, OWNER_OK], when: { notSafe: ['courier'] }, text: '', next: { ending: 'held_both' } },
  { if: [...also, OWNER_OUT], when: { safe: ['courier'] }, text: '', next: { ending: 'owner_left_down' } },
  { if: [...also, OWNER_OUT], when: { notSafe: ['courier'] }, text: '', next: { ending: 'held_both_down' } },
];

/** The taker comes out, and the group decides whether to follow (CASCADE_V1). */
const surrender = (all: string): Pick<TreeOutcome, 'out' | 'cascade'> =>
  ({ out: ['taker'], cascade: { leader: 'taker', group: 'others', next: { all: { ending: all }, some: { node: 'stayed_behind' }, none: { node: 'nobody_followed' } } } });

export const HOSTAGE_SIGNATURE: CallTree = {
  type: 'hostage_crisis',
  title: 'One Last Signature',
  roles: [
    { id: 'taker', label: 'former employee', pronouns: 'he', kind: 'subject',
      profile: '{taker.first} has no record. {taker.He} {taker~lives|live} alone above the laundromat two blocks over, and a cousin across town is {taker.his} emergency contact. {taker.He} told dispatch, “I just want it in writing.”',
      carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'handgun' } },
    { id: 'courier', label: 'courier', pronouns: 'he', kind: 'civilian',
      profile: '{courier.first} drives a route for a parcel firm and was in the doorway, waiting on a signature, when it started. {courier.He} {courier~has|have} eleven stops left and a van idling at the curb.' },
    { id: 'owner', label: 'owner', pronouns: 'she', kind: 'civilian',
      profile: '{owner.first} has run {place} for 22 years. A neighbor says {owner.he} {owner~hasn’t|haven’t} missed a day since {owner.his} spouse died, and still writes every sale into a ledger by hand.' },
    { id: 'cousin', label: 'cousin', pronouns: 'she', kind: 'bystander', place: 'outside',
      profile: '{cousin.first} is {taker.first}’s cousin and the name on {taker.his} emergency card. {cousin.He} {cousin~drives|drive} a bus on the night route and came straight from the depot when dispatch called.' },
    { id: 'regular', label: 'regular', pronouns: 'he', kind: 'bystander', place: 'outside',
      profile: '{regular.first} has come in every morning for nine years and is standing at the tape now in the same coat. {taker.first} usually has {regular.his} order poured before {regular.he} {regular~reaches|reach} the counter.' },
  ],
  groups: { others: { slot: 'subjects', leader: 'taker', label: 'coworker from the last shift' } },
  // A counter, a till and regulars: a shop floor, a sales floor or a bar.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 1 },
  summary: '{courier.first} should have left ten minutes ago. A fired worker with a handgun won’t let anyone leave until the owner signs a page clearing {taker.him}.',
  coldOpen: '{taker} opened {place} every day for six years. {taker.He} {taker~knows|know} which floorboard behind the counter groans and which regulars pay on Fridays. Yesterday {owner} counted the till out loud with three of those regulars watching, came up $340 short and fired {taker.first} before {taker.his} coffee went cold. This afternoon {taker.first} walked back in, flipped the sign to CLOSED and set a handgun on the counter beside the register. {courier}, a courier with eleven stops left, was still waiting on a signature.',
  pressureLabel: '{owner.first} at the till',
  pressure: { start: 20, perMinute: 0.25, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{taker.first} worked the counter here for six years until {owner.first} fired {taker.him} yesterday. Patrol says {taker.he} came back carrying a handgun, threatened the people inside and won’t let them go.',
    known: [
      '{taker.first} says {owner.first} called {taker.him} a thief in front of the regulars.',
      '{courier.first}, the courier, told the dispatcher, “I only needed one signature.”',
      '{courier.first} says {owner.first} sat down hard when {taker.first} shoved past {owner.him}.',
      'Patrol says {taker.first} keeps {owner.first} by the counter facing the street door.',
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
  threatMarks: { turned: '{taker.first} turned the handgun on {owner.first}', shot_inside: '{taker.first} fired a shot inside' },
  facts: {
    handgun: { public: true, source: 'Responding patrol', truth: true, label: 'Patrol’s handgun report',
      claim: 'Patrol says {taker.first} is holding a handgun on the people inside.',
      confirmed: 'The team saw the handgun at the counter.', disproved: 'The team could not see a handgun.' },
    lets_go: { label: '{taker.first}’s terms for {owner.first}', claim: '{taker.first} might let {owner.first} go without {owner.his} name on a statement.',
      confirmed: '{taker.first} says {owner.first} can go once {taker.his} side is written down.', disproved: '{taker.first} says {owner.first} signs or stays.' },
    owner_faint: { label: '{owner.first}’s condition', claim: 'How {owner.first} is holding up on the stool.',
      confirmed: '{owner.first} says {owner.his} chest has been tight since the shove.', disproved: '{owner.first} says {owner.he} {owner~is|are} shaken but all right.' },
    owner_wrong: { label: 'What {owner.first} found', claim: 'What {owner.first} found when {owner.he} counted the drawer again.',
      confirmed: '{owner.first} found the missing money the night {owner.he} fired {taker.first}.', disproved: '{owner.first} says {owner.he} never found the money.' },
    took_it: { label: '{taker.first}’s last shift', claim: 'What {taker.first} did on that last shift at the till.',
      confirmed: '{taker.first} took the money from the till, meaning to return it.', disproved: '{taker.first}’s account of the shift holds together.' },
    raised: { label: 'The view of the counter', claim: 'What officers at the glass see when {taker.first} stops answering.',
      confirmed: 'The team saw {taker.first} point the handgun at {owner.first}.', disproved: 'Through the glass, {taker.first} paces with the handgun down at {taker.his} side.',
      threat: '{taker.first} pointed the handgun at {owner.first}' },
  },
  situations: [
    { note: '{taker.He} {taker~wants|want} to be heard and will trade {owner.him} for a written account. Silence leaves {taker.him} pacing. The others came for {taker.him} and go where {taker.he} {taker~goes|go}. {owner.first} found the money that night and never called.', truth: { lets_go: true, raised: false, owner_faint: false, owner_wrong: true, took_it: false } },
    { note: '{taker.He} will trade, but a refusal turns the handgun on {owner.him}. {owner.He} {owner~is|are} unwell, and a long night costs {owner.him}. {owner.His} kid closed out the drawer, and signing names the kid.', truth: { lets_go: true, raised: true, owner_faint: true, owner_wrong: false, took_it: false } },
    { note: '{taker.He} {taker~wants|want} {owner.his} signature and nothing less, and {taker~turns|turn} on {owner.him} when pressed. The others are loosely held and freeze when {taker.he} {taker~walks|walk}. {taker.He} took the money, and the page is the lie {taker.he} {taker~needs|need}.', truth: { lets_go: false, raised: true, owner_faint: false, owner_wrong: false, took_it: true } },
  ],
  turns: { courier_out: ['out_back_door', 'out_keys', 'out_six_years', 'out_cousin'] },
  difficulty: { base: 40, perTier: 4 },
  root: 'offer',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'offer', stage: 'assess',
      threat: { label: '{courier.first} edges for the door', minutes: 4, text: '{courier.first} takes a half step toward the street door, and {taker.first} catches the strap of {courier.his} bag and pulls {courier.him} back.', pressure: 4 },
      prompt: 'The 911 call came from the counter phone, and {taker.first} picked up on the first callback. From the corner your squad can see {owner.first} on a stool at the till and {courier.first} in the doorway with a parcel under one arm. One of them is a stranger. The other is the reason {taker.first} came back.',
      exchange: [{ by: 'taker', line: 'The courier can go. Not {owner.him}.' }, { by: 'negotiator', line: 'What happened between you two?' }, { by: 'taker', line: 'Ask {owner.him}. {owner.He} {owner~knows|know}.' }],
      promptIf: [{ when: GROUP, prompt: '{others}, off the same shift, {others#stands|stand} by the door in work clothes, as if the shift never ended. {taker.first} has the counter phone. {owner.first} sits by the till, and {courier.first} is caught at the door between all of them.',
        exchange: [{ by: 'taker', line: 'Courier walks. {owner.He} {owner~doesn’t|don’t}.' }, { by: 'radio', line: 'More of them by the door with {taker.him}. Can’t see hands yet.' }, { by: 'taker', line: '{owner.He} {owner~knows|know}. Ask {owner.him}.' }] }],
      choices: [
        { id: 'take_courier', title: 'Walk {courier.first} out now', icon: 'door', walks: 'courier', check: check(MOVE, -6), minutes: 2,
          summary: '{lead} tells {taker.first} the courier is leaving and asks for nothing else. {owner.first} stays behind the counter with the one person in the building who blames {owner.him}, and {taker.first} learns you take what you are given.',
          pull: 'One person out, right now, before {taker.first} changes {taker.his} mind.',
          cost: 'The door is where people panic, and {owner.first} stays behind with the grievance.',
          preview: { favorable: '{courier.first} makes it to the patrol car, and {owner.first} is left on the stool.', mixed: '{courier.first} gets clear, and {taker.first} slams the phone down on the counter.', adverse: '{courier.first} panics at the door, and {taker.first} may fire to stop it.' },
          outcomes: {
            favorable: [
              { text: '{courier.first} walks out with {courier.his} bag on {courier.his} shoulder and the delivery slip still blank in {courier.his} hand. Behind the patrol car {courier.he} {courier~tells|tell} the team something nobody knew. Inside, {taker.first} pulls the blinds halfway and drags {owner.first}’s stool closer to the register, with {owner.first} still on it.',
                exchange: [{ by: 'courier', line: '{taker.He} gave me forty bucks for the cake. Said it’s {owner.his} birthday.' }],
                safe: ['courier'], mark: ['birthday'], moves: { taker: 'released' }, next: { turn: 'courier_out' }, objective: 30, pressure: -3 },
              { when: GROUP, text: '{others.first} holds the door for {courier.first}, then steps back in.' },
            ],
            mixed: [{ text: '{courier.first} gets out, but {courier.his} phone is still on the counter by the register. {taker.first} picks it up, reads the last message out loud to {owner.first}, and then the next one, in a flat voice, as if reading a receipt.',
              safe: ['courier'], mark: ['hung_up', 'phone_read'], moves: { taker: 'provoked' }, next: { turn: 'courier_out' }, objective: 25, pressure: 4 }],
            // No safe choice (owner 2026-10-19): the plain walk-out can end in a shot.
            adverse: [{ text: 'At the door {courier.first} grabs {owner.first}’s wrist to take {owner.him} too. {taker.first} fires into the ceiling. Plaster comes down on all three of them, {courier.first} freezes in the doorway, and {owner.first} is pulled back behind the counter.',
              mark: ['shot_inside'], moves: { taker: 'shots' }, next: { node: 'fired_on' }, pressure: 14, civilian: -6 }],
          } },
        { id: 'ask_both', title: 'Ask for {owner.first} too', icon: 'radio', walks: 'courier', talksTo: 'taker', check: check(TALK), minutes: 4,
          summary: '{lead} thanks {taker.first} for the courier and asks for {owner.first} in the same breath. Your squad waits at the shop door for {courier.first} while you push, and an offer that was free a minute ago can turn into a price.',
          pull: 'Both of them, before {taker.first} settles into keeping {owner.first}.',
          cost: '{courier.first} stays inside while you push, and the first offer can vanish.',
          preview: { favorable: 'You learn {taker.first}’s price for {owner.first}.', mixed: '{taker.first} keeps the offer to {courier.first} alone and starts a countdown.', adverse: '{taker.first} turns the offer into a choice {owner.first} has to make, out loud.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} goes quiet long enough that the team checks the line. Then {taker.he} {taker~names|name} a price, and it is smaller than anyone expected. {owner.first} can go once somebody writes down what happened to the money, in {taker.his} words, and reads it back.', reveal: ['lets_go'], mark: ['terms'], moves: { taker: 'contact' }, next: { node: 'his_side' }, objective: 15 },
              { if: KEEPS, text: 'Only a statement with {owner.his} name under it will do, {taker.first} says. Not {taker.his} side written down, not a promise. {owner.first}’s own signature, saying {taker.first} took nothing. {courier.first} is still at the door, close enough to touch it.', reveal: ['lets_go'], next: { node: 'one_door' }, objective: 10 },
            ],
            mixed: [{ text: '{taker.first} says the offer covers {courier.first} and nobody else, and the question about {owner.first} has made it smaller. Then {taker.he} {taker~starts|start} counting down from ten, slowly, out loud, into the receiver.', mark: ['counting'], moves: { taker: 'provoked' }, next: { node: 'one_door' }, pressure: 6 }],
            adverse: [{ text: '{taker.first} takes the offer back and makes a new one. One of them walks, and {owner.first} picks who. {owner.first} looks at {courier.first} for a long second and sends {courier.him} out. {taker.first} watched {owner.him} choose to stay with the person who blames {owner.him}, and doesn’t know what to do with that.', safe: ['courier'], mark: ['owner_chose'], moves: { taker: 'provoked' }, next: { turn: 'courier_out' }, objective: 20, pressure: 6 }],
          } },
        { id: 'hear_him', title: 'Let {taker.first} talk first', icon: 'radio', talksTo: 'taker', check: check(TALK, 1), minutes: 5, certBonus: NEGOTIATOR,
          summary: '{lead} asks what happened with the money and then lets the silence do the asking. {lead} offers nothing and sets no deadline. {courier.first} lingers in the doorway, parcel under one arm, for as long as the answer takes.',
          pull: 'Learn who {taker.first} is before you bargain with {taker.him}.',
          cost: 'Minutes spent listening are minutes {courier.first} spends in the doorway.',
          preview: { favorable: 'You hear why {taker.first} came back today.', mixed: '{taker.first} talks, then makes a signature the price of anyone leaving.', adverse: 'You get an open line and no voice on it.' },
          outcomes: {
            favorable: [
              { text: '{taker.first} talks for a long time. Six years of opening up, the floor {taker.he} mopped on {taker.his} own time, the regulars who asked for {taker.him} by name. Then yesterday afternoon, when {owner.first} counted the drawer aloud in front of those same regulars. {taker.He} {taker~wants|want} one thing. A page that says {taker.he} took nothing.', exchange: [{ by: 'taker', line: 'Six years. I never even took the pens home.' }], moves: { taker: 'heard' }, next: { node: 'his_side' }, objective: 15, pressure: -6 },
              { when: GROUP, text: '{others} {others#nods|nod} along at every line.' },
              { when: { lead: ['calm_voice'] }, text: 'The calmest voice on the squad never once interrupts. Near the end {taker.first} says nobody has let {taker.him} finish a sentence in two days.' },
            ],
            mixed: [{ text: '{taker.first} goes over the till count line by line, the way someone does after going over it all night. Twenties, tens, the roll of quarters that was never opened. Then {taker.he} {taker~says|say} nobody leaves until {owner.first} signs a statement clearing {taker.him}.', mark: ['sign_demand'], moves: { taker: 'heard' }, next: { node: 'his_side' }, objective: 10 }],
            adverse: [{ text: 'The answers stop. The line stays open, and the radio is the only sound on it, a ballgame in the late innings. Nobody inside turns it down. Once, very faintly, someone coughs.', mark: ['silent'], next: { node: 'both_inside' }, pressure: 6 }],
          } },
        // The opening gamble: the owner speaks before anyone has framed it (owner 2026-10-19).
        { id: 'owner_first', title: 'Ask to hear from {owner.first} first', icon: 'radio', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'owner' } }, check: check(TALK, 4), minutes: 3, consequenceLevel: 'moderate',
          summary: '{lead} stands at the shop window in plain view and asks {taker.first} to let {owner.first} speak, there and then, before anything is agreed. Nobody has heard {owner.him} yet. Whatever {owner.he} {owner~says|say} first sets the shape of everything after, and {taker.first} is standing right there.',
          pull: '{owner.first}’s first words, before anyone has decided what they mean.',
          cost: 'One wrong sentence from {owner.first}, said in front of the whole street.',
          preview: { favorable: '{owner.first} says one sentence, and the call changes shape.', mixed: '{owner.first} starts to speak and is cut off.', adverse: '{owner.first} says the wrong thing, and the handgun could come up at {owner.him}.' },
          outcomes: {
            favorable: [
              { if: { fact: 'owner_wrong', is: true }, text: '{owner.first} speaks before {taker.first} can stop {owner.him}, one plain sentence about the drawer. {taker.first} doesn’t say a word for long enough that officers at the corner start to look at each other.',
                exchange: [{ by: 'owner', line: 'I counted it again that night.' }], reveal: ['owner_wrong'], mark: ['owner_heard', 'owner_admits'], moves: { taker: 'heard' }, next: { node: 'his_side' }, objective: 18 },
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} gets two words out before {owner.his} breath runs short. {taker.first} hears an apology for being called a thief. {courier.first}, by the door, hears an apology for something else entirely.',
                exchange: [{ by: 'owner', line: 'I’m sorry.' }], reveal: ['owner_faint'], mark: ['owner_heard', 'owner_unwell'], moves: { taker: 'heard' }, next: { node: 'his_side' }, objective: 12 },
              { if: { fact: 'took_it', is: true }, text: '{owner.first} says one short thing and stops. {taker.first} asks what that is supposed to mean, twice, and {owner.first} doesn’t answer either time.',
                exchange: [{ by: 'owner', line: 'I never told anyone.' }], mark: ['owner_heard'], moves: { taker: 'provoked' }, next: { node: 'his_side' }, objective: 10 },
            ],
            mixed: [{ text: '{owner.first} gets out one word before {taker.first} takes the receiver back. {taker.first} has decided {taker.he} {taker~doesn’t|don’t} want to hear the rest yet.', moves: { taker: 'provoked' }, next: { node: 'one_door' }, objective: 6 }],
            adverse: escalate({
              lead: '{owner.first} looks straight at {taker.first} and says, “You know what you did.” The regulars at the tape hear {taker.first} shout back through the glass.',
              threat: '{taker.first} levels the handgun at {owner.first}, and {taker.his} hand is shaking.',
              quiet: '{taker.first} pulls the phone cord out of the wall and stands in the middle of the floor, breathing hard.',
              quietNext: { node: 'both_inside' },
              extra: { mark: ['silent'], moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        // A look before an answer (owner 2026-10-20: three kinds of act on every stage). The offer hangs while you watch.
        { id: 'watch_counter', title: 'Watch the counter before you answer', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'taker' } }, check: check(ASK), minutes: 3, consequenceLevel: 'moderate',
          certBonus: { cert: 'surveillance', value: 6, label: 'Surveillance training' },
          summary: '{lead} lets the offer hang while your squad watches the counter from the corner. {courier.first} hasn’t moved from the door. {taker.first} is waiting on an answer that doesn’t come.',
          pull: 'See who {taker.first} watches before you bargain with {taker.him}.',
          cost: 'An offer left hanging, with {courier.first} still at the door.',
          preview: { favorable: 'You see where {taker.first} keeps the handgun and who {taker.he} {taker~watches|watch}.', mixed: 'You see the counter, and {taker.first} sees officers at the corner.', adverse: '{taker.first} takes the silence as a no, and {owner.first} could pay for it.' },
          outcomes: {
            favorable: [
              { text: 'From the corner the team watches {taker.first} for a full minute. The handgun sits by the register. {taker.first} looks at {owner.first} every few seconds and at {courier.first} only once. Above the till, a camera’s red light is still on.', reveal: ['handgun'], mark: ['camera_seen'], moves: { taker: 'contact' }, next: { node: 'his_side' }, objective: 10 },
              { when: { lead: ['observant'] }, text: 'The squad’s sharpest pair of eyes spots a legal pad beside the till, already headed with yesterday’s date.' },
            ],
            mixed: [{ text: '{taker.first} catches a helmet at the corner and steps behind {owner.first}’s stool. The offer for {courier.first} still stands, but now there is a count on it, out loud, from ten.', mark: ['counting'], moves: { taker: 'team_seen' }, next: { node: 'one_door' }, objective: 4, pressure: 4 }],
            adverse: escalate({
              lead: '{taker.first} decides the silence is the answer and drags {courier.first} back from the door by {courier.his} collar.',
              threat: '{taker.first} raises the handgun toward {owner.first} and says the next quiet minute costs {owner.him}.',
              quiet: '{taker.first} hangs up and lets every callback ring out.',
              quietNext: { node: 'both_inside' },
              extra: { mark: ['silent'], moves: { taker: 'provoked' }, pressure: 8 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the courier is out (one turn per call)
    { id: 'out_back_door', stage: 'adapt',
      threat: { label: 'The back door opens', minutes: 4, text: 'The steel door in the alley opens a hand’s width, then shuts again. Nobody comes out.', pressure: 5 },
      prompt: '{courier.first} is out and talking fast behind the patrol car. In the alley, the steel back door has a handle that has turned twice since your squad arrived, slowly, the way someone tests a lock they already know is open. {owner.first} is still at the till, out of sight from the street.',
      exchange: [{ by: 'courier', line: '{taker.He} kept looking at that back door, like it owed {taker.him} something.' }, { by: 'negotiator', line: 'Did {taker.he} say where {taker.he}’d go?' }, { by: 'courier', line: 'Just that nobody was going to watch {taker.him} walk out.' }],
      promptIf: [
        { when: { marks: ['hung_up'] }, prompt: 'The call was cut off. {courier.first} says the back way out is all {taker.first} watches.',
          exchange: [{ by: 'courier', line: 'I didn’t run. I walked fast. {taker.He} still slammed the phone down.' }] },
        { when: GROUP, prompt: '{courier.first} says {taker.first} kept eyeing the alley, and {others} kept eyeing {taker.first}.' },
      ],
      choices: [
        { id: 'team_alley', title: 'Cover the alley door', icon: 'perimeter', team: { to: { vantage: 'scene' } }, check: check(MOVE), minutes: 4, consequenceLevel: 'moderate',
          summary: '{lead} leads your squad down the alley to the back door, close enough to stop {taker.first} leaving with {owner.first} as a shield. The alley is loose gravel and broken pallets, and boots on gravel carry through a steel door better than anyone would like.',
          pull: 'If {taker.first} runs out the back with {owner.first}, you are already there.',
          cost: 'Every step on the gravel tells {taker.first} where you are.',
          preview: { favorable: 'You reach the rear unheard, with {taker.first} still on the line.', mixed: 'You get there, but {taker.first} heard you coming and says so.', adverse: 'The crunch of gravel could send {taker.first} back to {owner.first} with {taker.his} handgun raised.' },
          outcomes: {
            favorable: [{ text: 'The team settles in on either side of the alley door without a sound anyone inside could name. A minute later {taker.first} calls dispatch back, not the negotiator, and asks a dispatcher who is standing in {taker.his} alley. {taker.He} {taker~calls|call} it {taker.his} alley twice.', mark: ['team_close'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: 'The team reaches the rear exit, and the gravel carries inside with them. Within a minute dispatch has {taker.first} on another line, saying the alley is full of police and asking whether the street is next. The handle on the steel door stops turning.', mark: ['team_close'], moves: { taker: 'team_seen', others: 'team_seen' }, next: { node: 'talking' }, pressure: 5 }],
            adverse: [{ when: { lead: ['rookie'] }, text: 'The squad’s rookie is the one whose boot found the pallet, and everyone on the squad heard it.' }, ...escalate({
              lead: 'A pallet shifts under an officer’s boot and goes over with a crack like a dropped tray. Inside, every sound stops.',
              threat: '{taker.first} yanks {owner.first} behind the register and aims at {owner.him}.',
              quiet: 'Calls go unanswered after that, with {taker.first} planted between {owner.first} and the front.',
              extra: { mark: ['team_close'], moves: { taker: 'team_seen', others: 'team_seen' }, pressure: 10 } })],
          } },
        { id: 'ask_door', title: 'Ask about the back door', icon: 'radio', talksTo: 'taker', check: check(TALK), minutes: 3,
          summary: '{lead} rings the counter and asks, plainly, what {taker.first} wants with the exit out back. The question might tell you how {taker.he} {taker~means|mean} this to end. It also tells {taker.him} that somebody outside has been watching that handle.',
          pull: 'Learn how {taker.first} pictures walking out, before {taker.he} {taker~tries|try} it.',
          cost: '{taker.first} knows the back door is watched now.',
          preview: { favorable: 'You find out how {taker.first} wants to leave.', mixed: '{taker.first} answers, then calls the rear door {taker.his} business.', adverse: '{taker.first} may go quiet and point {taker.his} handgun over the counter at {owner.first}.' },
          outcomes: {
            favorable: [{ text: '{taker.first} answers right away, as if {taker.he} {taker~has|have} been waiting for someone to ask. {taker.He} {taker~wants|want} to walk out the back when this is over, so the regulars at the tape don’t see {taker.him} come out with {taker.his} hands up. Then, quieter, {taker.he} {taker~asks|ask} whether that is allowed.', mark: ['wants_back'], moves: { taker: 'heard' }, next: { node: 'talking' }, objective: 12, pressure: -4 }],
            mixed: [{ text: 'Six rings go by before anyone picks up. “The back door’s my business,” {taker.first} says. {taker.He} {taker~doesn’t|don’t} hang up, though. For almost a minute the line carries only breathing and the hum of the drinks cooler, and then {taker.he} {taker~asks|ask} if the courier got home.', moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: 'The line goes dead in the middle of the question, and nobody touches the back door again.',
              threat: 'Through the front window, officers watch the handgun swing toward {owner.first}.',
              quiet: 'Behind the shelves, {taker.he} {taker~paces|pace} while the team’s calls ring out.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },
    { id: 'out_keys', stage: 'adapt',
      threat: { label: 'The twenties, counted aloud', minutes: 5, text: '{taker.first} has started counting the twenties in the till out loud to {owner.first}, one at a time, slower with each bill.', pressure: 4 },
      prompt: '{courier.first} says {taker.first} took {owner.first}’s keys off the hook and {owner.his} phone off the counter before letting the courier go. The front door is locked from inside now, and the only key to it is in {taker.first}’s shirt pocket.',
      exchange: [{ by: 'courier', line: '{taker.He} buttoned the keys into {taker.his} shirt pocket and patted it twice.' }],
      promptIf: [
        { when: { marks: ['hung_up'] }, prompt: '{taker.first} cut the call. {courier.first} says {owner.first}’s keys went into {taker.his} pocket before the bolt turned, and that {owner.first} watched them go without a word.' },
        { when: GROUP, prompt: '{others.first} bolted the front on {taker.first}’s word once {courier.first} was out. {owner.first}’s keys are with {taker.first}.' },
      ],
      choices: [
        { id: 'spare_key', title: 'Get the landlord’s spare key', icon: 'door', check: check(MOVE, -8), minutes: 20,
          summary: 'The landlord lives across town and keeps a spare in a coffee can. Twenty minutes, if the traffic is kind. Until it arrives {taker.first} keeps the only say over that door, and {owner.first} sits beside {taker.him} for every one of those minutes.',
          pull: 'A way in that doesn’t depend on {taker.first} saying yes.',
          cost: 'Twenty minutes or more with {owner.first} inside, and nothing you do in them.',
          preview: { favorable: 'The spare arrives while {taker.first} talks. If {owner.first} is unwell, {owner.he} may not last the wait.', mixed: 'The key comes late, and {taker.first} picks up without a word. {owner.first} could be on the floor by then.', adverse: 'The landlord never finds the key. {owner.first} may collapse waiting, or end up facing the handgun.' },
          outcomes: {
            favorable: [
              { text: 'The landlord pulls up at the corner in slippers and hands the spare key through the car window to the nearest officer.', mark: ['spare_key'], objective: 10 },
              { if: OWNER_OK, text: 'While the team waits, {taker.first} calls back on {taker.his} own. {taker.He} {taker~wants|want} to know if {courier.first} got home all right, and whether anybody signed for the parcel.', moves: { taker: 'contact' }, next: { node: 'talking' } },
              { if: OWNER_OUT, text: 'By then {owner.first} has slid to the floor, and {taker.first} is shouting for help down the phone.', next: { node: 'owner_down' } },
            ],
            mixed: [
              { text: 'Half an hour goes by before the landlord turns up with the key.', mark: ['spare_key'], moves: { taker: 'provoked' }, pressure: 6 },
              { if: OWNER_OK, text: 'When officers ring the counter, {taker.first} lifts the receiver and says nothing.', next: { node: 'talking' }, minutes: 10 },
              { if: OWNER_OUT, text: 'Inside, {owner.first} is stretched out on the tiles, and {taker.first} is yelling for a medic.', next: { node: 'owner_down' }, minutes: 10 },
            ],
            adverse: [
              { text: 'The landlord can’t find the spare key, and {taker.first} has started counting the minutes out loud.', pressure: 8 },
              { if: [OWNER_OK, RAISED], text: 'When the team calls back, the handgun is leveled at {owner.first}.', reveal: ['raised'], next: { node: 'threat' }, minutes: 8 },
              { if: [OWNER_OK, CALM], text: 'The line drops after {taker.first} says nobody is coming in.', reveal: ['raised'], next: { node: 'standoff' }, minutes: 8 },
              { if: OWNER_OUT, text: '{owner.first} has been folding over on the stool the whole time. {owner.He} {owner~is|are} down now, and {taker.first} won’t stop shouting.', next: { node: 'owner_down' }, minutes: 8 },
            ],
          } },
        { id: 'ask_unlock', title: 'Get the front unlocked', icon: 'radio', talksTo: 'taker', check: check(TALK), minutes: 3,
          summary: '{lead} asks {taker.first} to slide the bolt back, not to open the door, just to unlock it, as someone who can choose. It treats {taker.him} like a person with say over {taker.his} own exit. It also tells {taker.him} you are thinking about that door.',
          pull: 'An unlocked door changes every choice that comes after it.',
          cost: '{taker.first} hears that you are planning around that door.',
          preview: { favorable: 'The front gets unbolted but stays shut.', mixed: '{taker.first} turns the lock, then asks who you plan to send through.', adverse: '{taker.first} hears “door” and blocks it, and {owner.first} could be looking at the handgun.' },
          outcomes: {
            favorable: [{ text: 'The front bolt slides back with a sound the officers on the sidewalk hear from ten yards away. {taker.first} says the door stays shut. But the bolt stays open, and {taker.he} {taker~leaves|leave} it that way when {taker.he} {taker~walks|walk} back to the till.', mark: ['door_open'], moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 12, pressure: -3 }],
            mixed: [{ text: 'The lock turns, then turns back, then turns again and stays. {taker.first} asks twice who is coming through that door, and the second time {taker.his} voice cracks on the word “who.”', mark: ['door_open'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6, pressure: 3 }],
            adverse: escalate({
              lead: 'A shelf scrapes across the floor and slams against the front door from inside, and something glass breaks under it.',
              threat: 'Whatever was on the shelf scatters across the tiles. When the shelf stops, the handgun is on {owner.first}.',
              quiet: 'After that, the counter phone just rings.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },
    { id: 'out_six_years', stage: 'adapt',
      threat: { label: '{courier.first} wants to go', minutes: 4, text: 'Behind the patrol car, {courier.first} keeps checking the time and asks patrol twice whether {courier.he} can move the van.', pressure: 3 },
      prompt: '{courier.first} still has {courier.his} bag on, out by the cruiser, and {courier.he} {courier~keeps|keep} glancing back at the place like {courier.he} left something inside. {courier.He} {courier~says|say} {taker.first} told the same story three times while {courier.he} stood there, and never once finished it.',
      exchange: [{ by: 'courier', line: 'Six years, {taker.he} kept saying. Like it was printed on a sign.' }, { by: 'negotiator', line: 'Six years doing what?' }, { by: 'courier', line: 'Opening up. {taker.He} said {taker.he} opened up every single day.' }],
      promptIf: [
        { when: { marks: ['hung_up'] }, prompt: 'The receiver went down hard. Inside, {courier.first} heard about the final shift three times over.' },
        { when: GROUP, prompt: '{courier.first} says {others} backed up {taker.first}’s version of that shift word for word.' },
      ],
      choices: [
        { id: 'ask_courier', title: 'Ask {courier.first} about that day', icon: 'search', talksTo: 'courier', check: check(ASK), minutes: 5,
          modifiers: [{ label: '{courier.first}’s phone is still inside', mark: 'phone_read', value: -4 }],
          summary: '{courier.first} was inside for the first twenty minutes and heard more than anyone else out here. {lead} sits {courier.him} down in the back of the cruiser with water and asks {courier.him} to start at the beginning. {owner.first} spends those minutes on the stool next to {taker.first}.',
          pull: 'Walk into the next call knowing the story {taker.first} keeps starting.',
          cost: 'Nobody is on the line with {taker.first} while you listen.',
          preview: { favorable: '{courier.first} gives you the story {taker.first} kept starting.', mixed: '{courier.first} remembers part of the story while the counter goes unanswered.', adverse: '{courier.first} can’t help much, and the handgun could swing to {owner.first} meanwhile.' },
          outcomes: {
            favorable: [{ text: '{courier.first} remembers it nearly word for word. The till came up short on {taker.first}’s last shift, and {owner.first} said so loud enough for the regulars to hear. {taker.first} told {courier.him} {taker.he} never took a cent, and then said it again, and then asked {courier.first} if {courier.he} believed it.', mark: ['knows_story'], next: { node: 'talking' }, objective: 12 }],
            mixed: [{ text: '{courier.first} remembers the short till and the word “regulars,” and not much more, because {courier.he} {courier~was|were} watching the handgun the whole time. Meanwhile the place line rings once and stops, and nobody can say who called whom.', mark: ['knows_story'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6 }],
            adverse: escalate({
              lead: '{courier.first} keeps starting sentences and losing them. All {courier.he} can picture is the handgun, black against the white countertop.',
              threat: 'An officer at the glass sees {taker.first} grab {owner.first} by the sleeve, handgun out.',
              quiet: 'The next call from the team rings out.',
              extra: { pressure: 8 } }),
          } },
        { id: 'call_now', title: 'Call the counter phone now', icon: 'radio', talksTo: 'taker', check: check(TALK, 2), minutes: 2,
          summary: '{lead} calls the counter straight away, before the line goes cold and before {taker.first} settles into a story about who {taker.he} {taker~is|are} now. You go in knowing only what {taker.he} told dispatch, and nothing of the shift that brought {taker.him} here.',
          pull: 'Keep {taker.first} talking to you, not to {taker.himself}.',
          cost: 'You start blind, with nothing of what {courier.first} heard.',
          preview: { favorable: 'You get {taker.first} on the line, talking.', mixed: '{taker.first} wants to know what {courier.first} told you.', adverse: '{taker.first} ignores the ringing, and {owner.first} may face the handgun.' },
          outcomes: {
            favorable: [{ text: '{taker.first} answers on the second ring. Before the negotiator can say a word, {taker.he} {taker~asks|ask} if {courier.first} is all right. There is a cake in that parcel for somebody’s birthday.', moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{taker.first} answers and wants to know what {courier.first} has been saying about {taker.him}. The negotiator says only that {courier.first} is safe. {taker.first} says that means the courier told the team everything, and that none of it was true.', moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 5 }],
            adverse: escalate({
              lead: 'The counter phone rings out. {taker.first}’s own phone lights up beside the till with a name, and {taker.he} {taker~turns|turn} it face down.',
              threat: 'Officers watching from the corner see {taker.first} bring the handgun up toward {owner.first}.',
              quiet: '{taker.first} sits up on the counter, the handgun beside {taker.him} on the wood.',
              extra: { pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: both still inside
    // A complication (owner 2026-10-20): the taker's cousin reaches the tape. Family is a voice
    // nobody can script, and moving family away is watched from inside.
    { id: 'out_cousin', stage: 'adapt',
      threat: { label: '{cousin.first} gets to the step', minutes: 4, text: '{cousin.first} slips past patrol and gets as far as the front step before an officer turns {cousin.him} back. {taker.first} watched all of it through the glass.', pressure: 5 },
      prompt: '{courier.first} is out and shaking behind the patrol car. At the tape, {cousin.first} has come straight from the bus depot in uniform and is calling {taker.first}’s name toward the glass. Inside, {taker.first} has stopped answering the phone to listen.',
      exchange: [{ by: 'cousin', line: 'Let me talk to {taker.him}. I’m the one {taker.he} {taker~calls|call}.' }, { by: 'negotiator', line: 'When did you two last talk?' }, { by: 'cousin', line: 'Sunday. {taker.He} said {taker.he} {taker~was|were} fine.' }],
      choices: [
        { id: 'cousin_story', title: 'Ask {cousin.first} about {taker.him}', icon: 'search', check: check(ASK), minutes: 4, certBonus: NEGOTIATOR,
          summary: '{lead} takes {cousin.first} behind the cars and asks what {taker.first} was like last week. {cousin.first} wants to be at the glass, not answering questions, and nobody is on the line inside.',
          pull: 'The one person who knows {taker.first} outside of work.',
          cost: 'Minutes off the line while {cousin.first} pulls toward the tape.',
          preview: { favorable: '{cousin.first} tells you what yesterday did to {taker.first}.', mixed: '{cousin.first} talks, and the phone inside rings unanswered.', adverse: '{cousin.first} breaks away toward the glass, and {taker.first} sees it.' },
          outcomes: {
            favorable: [{ text: '{cousin.first} talks fast with {cousin.his} hands. {taker.first} called {cousin.him} last night from the laundromat, read the till count off a receipt twice and asked if {cousin.he} believed it. {cousin.first} said yes. {taker.first} hung up anyway.',
              exchange: [{ by: 'cousin', line: '{taker.He} {taker~doesn’t|don’t} want money. {taker.He} {taker~wants|want} somebody to say it.' }], mark: ['knows_story'], next: { node: 'talking' }, objective: 12 }],
            mixed: [{ text: '{cousin.first} answers in pieces, watching the glass the whole time. Inside, the counter phone rings out twice while the team listens to {cousin.him}.', mark: ['knows_story'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 8, pressure: 4 }],
            adverse: [{ text: '{cousin.first} breaks from the officer beside {cousin.him} and runs for the glass, shouting {taker.first}’s name. Patrol catches {cousin.him} at the curb, right under the window.', mark: ['cousin_seen'], moves: { taker: 'provoked' }, next: { node: 'talking' }, pressure: 8 }],
          } },
        { id: 'cousin_glass', title: 'Let {cousin.first} call through the glass', icon: 'radio', talksTo: 'taker', check: check(TALK, 2), minutes: 3, consequenceLevel: 'high',
          summary: '{lead} walks {cousin.first} to the corner of the glass and lets {cousin.him} speak, with your squad a step behind. Nobody can script what family says, and {taker.first} takes in all of it with {owner.first} beside {taker.him}.',
          pull: 'A voice {taker.first} trusts, right now.',
          cost: 'Family says what it says, and {owner.first} hears it too.',
          preview: { favorable: '{taker.first} comes to the glass for {cousin.first}.', mixed: '{cousin.first} gets one sentence in before {taker.first} turns away.', adverse: '{cousin.first} says the wrong thing in front of {owner.first}, with {taker.first} armed and listening.' },
          outcomes: {
            favorable: [{ text: '{taker.first} comes to the glass and puts a palm flat on it, level with {cousin.first}’s. Neither of them says much. When {taker.first} goes back to the phone, {taker.his} voice is lower.',
              exchange: [{ by: 'cousin', line: 'Come home. I’ll make the rice.' }], mark: ['knows_story'], moves: { taker: 'heard' }, next: { node: 'talking' }, objective: 14, pressure: -6 }],
            mixed: [{ text: '{cousin.first} gets out one sentence about Sunday dinner before {taker.first} turns away from the window and drags {owner.first}’s stool around too.', mark: ['cousin_seen'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6, pressure: 4 }],
            adverse: escalate({
              lead: '{cousin.first} asks through the glass what {taker.first} did with the money, the question everyone else has been too careful to ask.',
              threat: '{taker.first} swings around with the handgun leveled at {owner.first}, screaming that nobody believes {taker.him}, not even family.',
              quiet: '{taker.first} yanks the blinds down and goes quiet behind them.',
              quietNext: { node: 'talking' },
              extra: { mark: ['cousin_seen'], moves: { taker: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'cousin_away', title: 'Get {cousin.first} off the block', icon: 'perimeter', check: check(MOVE), minutes: 3,
          summary: 'Two of your officers walk {cousin.first} back past the cars and keep walking. {taker.first} can see police taking away the only person who came for {taker.him}, and {cousin.first} will remember who did it.',
          pull: 'No voice on the street you can’t control.',
          cost: '{taker.first} watches you remove family, and {cousin.first} won’t help you later.',
          preview: { favorable: '{cousin.first} goes without a word, and the line inside stays yours.', mixed: '{cousin.first} goes, shouting, and {taker.first} hears it.', adverse: '{cousin.first} fights the officers in view of the window, and {taker.first} turns on the room.' },
          outcomes: {
            favorable: [{ text: '{cousin.first} goes without a fight and stands at the far corner with folded arms. When the phone rings again, {taker.first} picks up.', mark: ['cousin_gone'], moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 8 }],
            mixed: [{ text: '{cousin.first} goes, but shouts back over {cousin.his} shoulder the whole way that the police took {cousin.him}. {taker.first} hears every word of it.', mark: ['cousin_gone'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 6, pressure: 5 }],
            adverse: escalate({
              lead: '{cousin.first} twists away at the curb, and it takes three officers to hold {cousin.him}, in full view of the window.',
              threat: '{taker.first} grabs {owner.first} by the collar and holds the handgun up against the glass for the street to see.',
              quiet: '{taker.first} unplugs the counter phone, and the line goes dead.',
              quietNext: { node: 'talking' },
              extra: { mark: ['cousin_gone'], moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },

    { id: 'both_inside', stage: 'adapt',
      threat: { label: 'The blinds come down', minutes: 5, text: '{taker.first} pulls the blinds the rest of the way down. From the corner the team can see feet under them and nothing else.', pressure: 5 },
      prompt: 'The offer is off. {courier.first} sits on the stacked boxes by the door with the parcel on {courier.his} knees, and {owner.first} is behind the counter, close enough to {taker.first} to touch. Two people now, and one of them was never part of this.',
      exchange: [{ by: 'radio', line: 'Courier sat back down. Can’t see the taker’s hands.' }],
      promptIf: [
        { when: { marks: ['silent'] }, prompt: 'No word from {taker.first} now, only the ballgame on the radio. {owner.first} waits at the register and {courier.first} near the entrance, and neither of them has moved since the line went quiet.' },
        { when: GROUP_IN, prompt: '{courier.first} is back on the boxes, and {others} {others#crowds|crowd} the doorway behind {courier.him}.' },
      ],
      choices: [
        { id: 'wait_silence', title: 'Hold the line in silence', icon: 'wait', talksTo: 'taker', check: check(HOLD, -4), minutes: 10,
          summary: 'You leave the next word to {taker.first} and let the silence work. {courier.first} and {owner.first} wait in there however long it takes, and {taker.first} has all that time to decide whose fault the silence is.',
          pull: 'Let {taker.first} come to you, on {taker.his} own time.',
          cost: 'Ten minutes of nothing for the two people inside.',
          preview: { favorable: '{taker.first} speaks first and wants to know who is out there.', mixed: 'The silence ends with word that nobody leaves.', adverse: 'The silence drags on, and {taker.first} may decide {owner.first} is to blame for it.' },
          outcomes: {
            favorable: [{ text: 'After ten quiet minutes, {taker.first} picks the receiver back up and asks whether anyone is still listening. {taker.He} {taker~sounds|sound} out of breath, as if {taker.he} {taker~has|have} been pacing behind the counter the whole time. The negotiator says yes, and waits.', moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 10, pressure: -5 }],
            mixed: [{ text: '{taker.first} finally answers, only to say nobody walks out today. Then {taker.he} {taker~reads|read} the date off the newspaper on the counter, as if the date means something to {taker.him}.', next: { node: 'standoff' }, objective: 4 }],
            adverse: escalate({
              lead: 'Ten minutes pass. When {taker.first} picks up, {taker.he} {taker~says|say} it doesn’t matter anymore, in a flat, even voice.',
              threat: 'From the street, officers see {taker.first} lift the handgun in {owner.first}’s direction.',
              quiet: 'The team can make out {taker.first} walking behind the counter, the handgun hanging at {taker.his} side.',
              extra: { mark: ['withdrawn'], pressure: 8 } }),
          } },
        // The crew layer: an observant officer reads the room and finds the camera (owner 2026-10-19).
        { id: 'read_glass', title: 'Have your observant officer read the room', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'taker' } }, check: check(ASK, -2), minutes: 4, consequenceLevel: 'moderate', onlyIf: { crew: ['observant'] },
          summary: 'Your most observant officer works along the glass from the corner, reading the room in pieces through the gap in the blinds. Hands, exits, the cooler, the ceiling. It is the kind of look that finds what nobody reported, and it puts an officer in {taker.first}’s line of sight.',
          pull: 'See what no report mentioned, before you choose anything else.',
          cost: 'An officer at the glass, in {taker.first}’s line of sight.',
          preview: { favorable: 'Your officer spots a detail in that room nobody reported.', mixed: 'Your officer sees the room, and {taker.first} sees your officer.', adverse: '{taker.first} catches the movement at the glass and may turn the handgun toward {owner.first}.' },
          outcomes: {
            favorable: [{ text: 'There is a camera above the door with a small red light, aimed straight at the register. Nobody inside has looked at it once. The officer also counts {owner.first}’s hands and {courier.first}’s, both empty, and sees the back exit bolted from inside.', mark: ['camera_seen', 'team_close'], next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: 'The officer sees the red light over the entrance and the bolted back exit, and then {taker.first} sees the officer. The blinds come down hard enough to rattle the glass.', mark: ['camera_seen', 'team_close'], moves: { taker: 'team_seen' }, next: { node: 'talking' }, pressure: 6 }],
            adverse: escalate({
              lead: 'A shadow crosses the blinds, and {taker.first} spins toward the window.',
              threat: 'The handgun swings from the window to {owner.first}, as if {owner.he} had signalled someone.',
              quiet: '{taker.first} drags the cooler in front of the window, and the room disappears from view.',
              extra: { mark: ['team_close'], moves: { taker: 'team_seen' }, pressure: 8 } }),
          } },
        { id: 'ask_again', title: 'Ask again for {courier.first}', icon: 'door', walks: 'courier', talksTo: 'taker', check: check(TALK, 4), minutes: 3,
          summary: 'Once more, {lead} asks for {courier.first} alone, the same request in fewer words. It worked once. Asking twice tells {taker.first} you think {taker.he} {taker~is|are} the kind of person who gives in when asked again, and that can harden {taker.him} against both of them.',
          pull: 'Get the person who never belonged in there out first.',
          cost: 'A second no is harder to undo than the first.',
          preview: { favorable: '{courier.first} walks free, and {taker.first} keeps talking.', mixed: '{courier.first} leaves, and {taker.first} calls that the last favor.', adverse: '{taker.first} keeps {courier.first} on the boxes because you asked.' },
          outcomes: {
            favorable: [{ text: '{taker.first} tells {courier.first} to go, and then, as {courier.first} reaches the door, to take the parcel too. The delivery slip is still blank in {courier.his} hand when {courier.he} {courier~steps|step} onto the sidewalk.', safe: ['courier'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 25 }],
            mixed: [{ text: '{courier.first} picks up {courier.his} bag and goes without being told twice. {taker.first} says that was the last favor anybody gets today. {owner.first} stays until {owner.he} {owner~signs|sign}, and the negotiator can tell {taker.first} that, word for word.', safe: ['courier'], mark: ['sign_demand'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 20 }],
            adverse: [{ text: '{taker.first} says {courier.first} stays now, because the team asked twice and {taker.he} {taker~is|are} done being asked. {courier.first} sits back down on the boxes and starts to cry without making a sound.', moves: { taker: 'provoked' }, next: { node: 'standoff' }, pressure: 8 }],
          } },
        { id: 'team_glass', title: 'Move up to the glass', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'taker' } }, check: check(MOVE), minutes: 3, consequenceLevel: 'moderate', onlyIf: LONE,
          summary: '{lead} brings your squad up to the front windows, in plain sight of {taker.first}, close enough to see hands and faces through the glass. {taker.first} will see your squad at {taker.his} own front windows.',
          pull: 'See what is happening at that counter with your own eyes.',
          cost: '{taker.first} sees your squad too, and the street sees all of you.',
          preview: { favorable: 'Once {taker.first} sees you, the phone gets answered.', mixed: '{taker.first} answers but moves {owner.first} out of view.', adverse: '{taker.first} retreats from the window and may drag {owner.first} along, handgun drawn.' },
          outcomes: {
            favorable: [{ text: '{taker.first} sees officers at the windows and freezes for a long second. Then {taker.he} {taker~picks|pick} up the counter phone and {taker~asks|ask}, not angry, just tired, what exactly they are all waiting for.', mark: ['team_close', 'saw_inside'], moves: { taker: 'team_seen' }, next: { node: 'talking' }, objective: 8 }],
            mixed: [{ text: '{taker.first} answers, but walks {owner.first} back behind the back shelves first, where nobody outside can see {owner.him}. The team can see {taker.first} fine. {owner.first} is gone from view.', mark: ['team_close', 'owner_hidden'], moves: { taker: 'team_seen' }, next: { node: 'talking' }, pressure: 6 }],
            adverse: [{ when: { lead: ['rookie'] }, text: 'The squad’s rookie is the one {taker.first} sees first, a full step past the corner of the glass without being told.' }, ...escalate({
              lead: 'A phone goes up at the tape as the team reaches the glass. {taker.first} sees it and drops the blinds.',
              threat: 'Through a gap in the slats, {taker.first} is holding {owner.first} by the arm, handgun raised.',
              quiet: 'The blinds stay down, and nobody picks up.',
              extra: { mark: ['team_close'], moves: { taker: 'team_seen' }, pressure: 8 } })],
          } },
        // The same look in a group call (R-G1): more people inside can see the glass, so it is
        // harder and provokes the coworkers too. Only its favorable band, where the squad holds the
        // windows, settles what the coworkers are holding (sightings) and sets saw_inside.
        { id: 'glass_group', title: 'Move up to the glass', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'taker' } }, check: check(MOVE, 3), minutes: 3, consequenceLevel: 'moderate', onlyIf: GROUP_IN,
          summary: '{lead} moves your squad up to the front windows, in view of {others} as well as {taker.first}. More eyes inside means more people who can see you coming, and one shout from any of them could drop the blinds.',
          pull: 'Count every pair of hands inside before anything else happens.',
          cost: 'More people inside to see you, and one shout ends the look.',
          preview: { favorable: 'You get a clear look at everyone inside before {taker.first} answers.', mixed: '{taker.first} answers but moves {owner.first} out of view.', adverse: '{others} {others#spots|spot} you first, and {taker.first} may pull {owner.first} close with the handgun drawn.' },
          outcomes: {
            favorable: [{ text: 'Officers hold the windows long enough to see every pair of hands inside, and who is standing where. Then {taker.first} notices them, and instead of the blinds, {taker.he} {taker~reaches|reach} for the counter phone.', mark: ['team_close', 'saw_inside'], moves: { taker: 'team_seen', others: 'team_seen' }, next: { node: 'talking' }, objective: 8 }],
            mixed: [{ text: '{taker.first} answers, then pushes {owner.first} behind the shelves where nobody outside can see {owner.him}.', mark: ['team_close', 'owner_hidden'], moves: { taker: 'team_seen', others: 'team_seen' }, next: { node: 'talking' }, pressure: 6 }],
            adverse: escalate({
              lead: '{others.first} points at the window, and the blinds come down.',
              threat: 'Through a gap in the slats, {taker.first} is holding {owner.first} by the arm, handgun raised.',
              quiet: 'The blinds stay down, and nobody picks up.',
              extra: { mark: ['team_close'], moves: { taker: ['team_seen', 'provoked'], others: 'team_seen' }, pressure: 8 } }),
          } },
        { id: 'free_others', title: 'Give {others.first} a way out', icon: 'door', talksTo: 'others', check: check(TALK, 2), minutes: 4, onlyIf: GROUP_IN, certBonus: { cert: 'deescalation', value: 6, label: 'De-escalation training' },
          summary: '{lead} tells {others} directly that the front door is open to {others.him}, and that walking out now is the best thing {others.he} could do for {taker.first}. They came to vouch for a friend. {taker.first} hears you pulling {taker.his} people away.',
          pull: 'Fewer people inside, and fewer who might back {taker.first} up.',
          cost: '{taker.first} hears you take {taker.his} people from {taker.him}.',
          preview: { favorable: '{others} {others#comes|come} out to you, and {taker.first} lets {others.him} go.', mixed: '{others.first} answers you but stays beside {taker.first}.', adverse: '{taker.first} keeps {others} where {others.he} {others~is|are} and could take it out on {owner.first}.' },
          outcomes: {
            favorable: [{ text: '{others} {others#looks|look} at {taker.first} first. {taker.first} waits a long moment and then says go. {others} {others#files|file} out the street door with open palms, and officers walk {others.him} to the far side of the tape.', out: ['others'], mark: ['others_out'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 10 }],
            mixed: [{ text: '{others.first} answers, then says nobody is leaving {taker.first} in there alone, not after six years of covering each other’s shifts. The front door stays shut.', moves: { others: 'heard' }, next: { node: 'talking' }, objective: 4 }],
            adverse: escalate({
              lead: '{taker.first} orders {others} to stay where {others.he} {others~is|are}.',
              threat: 'Then the handgun goes to {owner.first}, the one {taker.he} {taker~blames|blame} for all of it.',
              quiet: 'After that the line is dead, and nobody comes near the glass.',
              extra: { moves: { taker: 'provoked', others: 'provoked' }, pressure: 8 } }),
          } },
      ] },
    { id: 'his_side', stage: 'adapt',
      threat: { label: 'The till count, again', minutes: 5, text: '{taker.first} starts reading the till count aloud to {owner.first}, slower this time, waiting after each line for an answer.', pressure: 4 },
      prompt: 'There is a yellow legal pad on the counter now, and a pen from the cup by the register. {courier.first} is still by the door, waiting to see whether that page gets written and whether writing it will be enough. {owner.first} has not looked at the pad once.',
      exchange: [{ by: 'taker', line: 'Write it down. Six years and not one cent.' }, { by: 'owner', line: 'I counted that drawer twice.' }],
      promptIf: [
        { when: { marks: ['terms'] }, prompt: 'A written account would buy {owner.first}’s way out. That is the price {taker.first} named. {courier.first} is waiting near the boxes, and the legal pad is on the counter between everyone.' },
        { when: { marks: ['sign_demand'] }, prompt: '{taker.first} wants {owner.first}’s name under a page that clears {taker.him}, and nothing less. Not your word, not a statement in {taker.his} own hand. {owner.first}’s signature, in front of witnesses, the way the accusation was made.' },
        { when: GROUP_IN, prompt: 'The pad is still blank. {others} {others#keeps|keep} glancing at {courier.first} and the exit, as if counting how many people the door can take at once.' },
      ],
      choices: [
        { id: 'courier_first', title: 'Walk {courier.first} out first', icon: 'door', walks: 'courier', check: check(MOVE, -2), minutes: 2,
          summary: '{lead} asks for {courier.first} first, before anything about the page is agreed. The stranger goes home. {owner.first} stays, and {taker.first} is left holding one person, the one {taker.he} came for, which makes everything after this harder to trade.',
          pull: 'The person with no part in this goes home first.',
          cost: '{taker.first} has only {owner.first} left, and holds on tighter.',
          preview: { favorable: '{courier.first} is clear, and {taker.first} keeps on about the money.', mixed: '{courier.first} is out, and the price for {owner.first} goes up.', adverse: '{taker.first} won’t let {courier.first} reach the exit.' },
          outcomes: {
            favorable: [{ text: '{courier.first} walks out with nothing signed and nothing promised. {taker.first} watches {courier.him} all the way to the patrol car, then goes back to the till and picks up the pen, as if the hard part is over and the writing can start.', safe: ['courier'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 25 }],
            mixed: [{ text: '{courier.first} gets away. {taker.first} lets the door swing shut and says the price for {owner.first} just went up. Before anything else is said, {owner.first} signs. {taker.He} {taker~says|say} it slowly into the receiver, as if dictating.', safe: ['courier'], mark: ['sign_demand'], moves: { taker: 'released' }, next: { node: 'standoff' }, objective: 20 }],
            adverse: [{ text: '{taker.first} steps between {courier.first} and the door without raising the handgun. No one goes anywhere until the writing is done, {taker.he} {taker~says|say}. {courier.first} backs up until {courier.his} shoulders touch the cooler.', moves: { taker: 'provoked' }, next: { node: 'standoff' }, pressure: 6 }],
          } },
        { id: 'write_now', title: 'Write down {taker.his} side', icon: 'handover', talksTo: 'taker', check: check(TALK), minutes: 6, authority: { concede: 'statement' },
          modifiers: [{ label: '{taker.He} named {taker.his} terms', mark: 'terms', value: 8 }],
          summary: '{lead} offers to take down {taker.first}’s account, word for word, and pass it up the line. Command will stand behind that much. The page will carry no signature but {taker.hers}, and {taker.he} will hear that it clears nobody, it only records.',
          pull: 'Give {taker.first} the thing {taker.he} can actually have.',
          cost: 'A page without {owner.first}’s name may not be enough.',
          preview: { favorable: 'You get {taker.first}’s side on paper, and {owner.first} may walk.', mixed: 'The account goes down on paper, but {owner.first} stays put.', adverse: '{taker.first} asks you to call {owner.first} a liar. When you won’t, {owner.first} may pay for it.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'For six minutes the negotiator writes while {taker.first} talks, and reads every line back without being asked. When it is done {taker.first} is quiet for a while. Then {taker.he} {taker~waves|wave} {courier.first} and {owner.first} toward the door, and the two of them leave together, not quite touching.', reveal: ['lets_go'], safe: ['courier', 'owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 55, pressure: -10 },
              { if: KEEPS, text: 'Every word goes on the pad, and some of the words are good ones. Then {taker.first} asks who is going to sign it, and when the answer is nobody, {taker.he} {taker~says|say} none of it counts until {owner.first} puts {owner.his} name at the bottom.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 15 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} frees {courier.first} halfway through, almost absently, with a wave of the pen. {owner.first} stays at the register while the notes are read back, because {taker.first} wants {owner.him} to hear all of it.', reveal: ['lets_go'], safe: ['courier'], mark: ['account'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 35 },
              { if: KEEPS, text: 'Once the account is done, {taker.first} tears the page off the pad, folds it in half and calls it worthless without {owner.first}’s name on it.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 12 },
            ],
            adverse: escalate({
              lead: '{taker.first} stops halfway through and asks the negotiator to write one more line, that {owner.first} lied. The negotiator won’t write it.',
              threat: '{taker.He} {taker~levels|level} the handgun across the till before the negotiator can finish a sentence.',
              quiet: 'Then {taker.he} {taker~says|say} {owner.first} can sit there until {owner.he} {owner~signs|sign}.',
              extra: { moves: { taker: 'provoked' }, pressure: 6 } }),
          } },
        { id: 'owner_voice', title: 'Ask to hear from {owner.first}', icon: 'radio', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR,
          summary: '{lead} offers {owner.first} the chance to speak for {owner.himself}. Nobody has heard {owner.him} since this started. {taker.first} will hear every word about the count and the signature, standing three feet away.',
          pull: 'The one person who knows what happened to the money gets a voice.',
          cost: '{taker.first} hears every word {owner.first} says, before you do.',
          preview: { favorable: '{owner.first} comes on the line and says what {owner.he} {owner~knows|know} about the till.', mixed: '{owner.first} gets the phone and refuses to sign.', adverse: '{taker.first} keeps {owner.first} away from the receiver.' },
          outcomes: {
            // The reframe (D2): what {owner.first} says about the till changes what "Ask her. She knows." meant.
            favorable: [
              { if: { fact: 'owner_wrong', is: true }, text: '{owner.first} takes the receiver in both hands and says the money was in a deposit bag nobody had opened, fallen behind the safe. {owner.He} found it at closing. {owner.He} never called {taker.first}.',
                exchange: [{ by: 'owner', line: 'I was going to call you. I didn’t know how to start.' }, { by: 'taker', line: 'You could have started with sorry.' }],
                reveal: ['owner_wrong'], mark: ['owner_heard', 'owner_admits'], moves: { taker: 'heard' }, next: { node: 'talking' }, objective: 14 },
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} is short of breath and has to stop twice. {owner.He} {owner~says|say} {owner.he} won’t sign, and not because {owner.he} {owner~thinks|think} {taker.first} took the money.',
                exchange: [{ by: 'owner', line: 'My kid closed that night. Not you.' }, { by: 'taker', line: 'So it was easier to say it was me.' }],
                reveal: ['owner_faint'], mark: ['owner_heard', 'owner_unwell'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 10 },
              { if: { fact: 'took_it', is: true }, text: '{owner.first} speaks so low that the negotiator asks {owner.him} to repeat it. {owner.He} watched {taker.first} take the money on the camera, {owner.he} {owner~says|say}, and kept it out of the police report. {owner.He} never meant to say it out loud.',
                exchange: [{ by: 'owner', line: 'I gave you a week’s pay so you could leave with something.' }, { by: 'taker', line: 'Turn the speaker off. Turn it off.' }],
                reveal: ['took_it'], mark: ['owner_heard', 'camera_said'], moves: { taker: 'provoked' }, next: { node: 'talking' }, objective: 10 },
            ],
            mixed: [
              { if: { fact: 'owner_faint', is: false }, text: '{owner.first} says {owner.he} won’t sign anything {owner.he} {owner~doesn’t|don’t} believe, not for anybody. The receiver is taken back before {owner.he} can say why, and {taker.first} doesn’t ask.', reveal: ['owner_faint'], mark: ['owner_heard', 'sign_demand'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 6 },
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} refuses to sign, then has to stop for air in the middle of the sentence. The phone is pulled out of {owner.his} hand, and the team can hear {owner.him} breathing hard in the background.', reveal: ['owner_faint'], mark: ['owner_heard', 'owner_unwell', 'sign_demand'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 6 },
            ],
            adverse: [{ text: '{taker.first} says {owner.first} can talk once {owner.he} {owner~signs|sign}, and not one word before. {taker.He} {taker~holds|hold} the receiver against {taker.his} chest, out of {owner.first}’s reach.', next: { node: 'standoff' }, pressure: 5 }],
          } },
      ] },
    { id: 'one_door', stage: 'adapt',
      threat: { label: 'The clock over the register', minutes: 3, text: '{taker.first} taps the clock over the register and says {courier.first} has until the minute hand reaches the top.', pressure: 6 },
      prompt: '{courier.first} can still walk out. That door is open, for now. For {owner.first}, the price is a signature, and the only person who can pay it is the one person in the room who believes {taker.first} took the money.',
      exchange: [{ by: 'taker', line: '{owner.His} name on the bottom. Then everybody goes home.' }, { by: 'negotiator', line: 'What does {owner.his} name fix for you?' }, { by: 'taker', line: 'Everything.' }],
      promptIf: [
        { when: { marks: ['counting'] }, prompt: 'The count from ten has started, slow and out loud into the receiver. The door is open for {courier.first} only, and the offer gets smaller with every number.' },
        { when: GROUP, prompt: '{others} {others#stands|stand} nearest the exit, and {courier.first} is right behind {others.him}.' },
      ],
      choices: [
        // The temptation (dilemma pattern 15, E12.6): command never agreed, and neither did the owner.
        // It frees the courier now and breaks in stage 3 (FOUND_OUT, own_up), or holds if the taker
        // walks out first.
        { id: 'say_she_signs', title: 'Tell {taker.him} {owner.first} will sign', icon: 'radio', walks: 'courier', talksTo: 'taker', check: check(TALK, 4), minutes: 2, stress: 6, onlyIf: LONE, deceives: true,
          summary: '{lead} tells {taker.first} that {owner.first} will sign. Command can’t promise that, and {owner.first} hasn’t agreed to anything. {taker.first} may free {courier.first} on that word right now, and then {taker.he} will want the page.',
          pull: '{courier.first} walks out now, on one sentence.',
          cost: 'A lie {taker.first} will come back for, with the handgun in reach.',
          preview: { favorable: '{courier.first} walks out on your word. {taker.first} will want to see the page.', mixed: '{courier.first} gets out, and {taker.first} starts asking when {owner.first} signs.', adverse: '{taker.first} asks {owner.first} to say it, and {owner.first} could face the handgun.' },
          outcomes: {
            favorable: [
              { when: { marks: ['counting'] }, text: 'The count stops at four. {taker.first} waves {courier.first} out without looking at {courier.him}, pulls the legal pad across the counter and sets the pen on it, uncapped, pointing at {owner.first}.', exchange: [{ by: 'taker', line: '{owner.His} name. Today.' }, { by: 'negotiator', line: 'Today.' }],
                safe: ['courier'], promise: { id: 'will_sign', to: 'taker', kind: 'lie' }, mark: ['lied_sign'], moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 25 },
              { when: { notMarks: ['counting'] }, text: '{taker.first} waves {courier.first} out without looking at {courier.him}, pulls the legal pad across the counter and sets the pen on it, uncapped, pointing at {owner.first}.', exchange: [{ by: 'taker', line: '{owner.His} name. Today.' }, { by: 'negotiator', line: 'Today.' }],
                safe: ['courier'], promise: { id: 'will_sign', to: 'taker', kind: 'lie' }, mark: ['lied_sign'], moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 25 },
            ],
            mixed: [{ text: '{courier.first} gets out on the negotiator’s word. {taker.first} asks twice how long a signature takes, and the second time it sounds less like a question.', safe: ['courier'], promise: { id: 'will_sign', to: 'taker', kind: 'lie' }, mark: ['lied_sign'], moves: { taker: 'contact' }, next: { node: 'talking' }, objective: 20, pressure: 3 }],
            adverse: escalate({
              lead: '{taker.first} holds the receiver out to {owner.first} and tells {owner.him} to say it, so everyone can hear. {owner.first} looks at the receiver, then at {taker.first}, and says {owner.he} never said that.',
              threat: 'The handgun comes up at {owner.first}, and {taker.first} says the negotiator lied to {taker.him}.',
              quiet: '{taker.first} hangs up on the negotiator and lets the next calls ring.',
              extra: { moves: { taker: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'others_courier', title: 'Let {others.first} take {courier.first} out', icon: 'door', walks: 'courier', talksTo: 'others', check: check(TALK), minutes: 3, onlyIf: GROUP,
          summary: '{lead} invites {others} to walk {courier.first} out and stay out. It gives {others.him} a way to leave that looks like a kindness, not a betrayal. Every word of it reaches {taker.first}.',
          pull: 'The courier out, and the coworkers with {courier.him}.',
          cost: '{taker.first} hears you peel {taker.his} people away.',
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
        { id: 'honest_limit', title: 'Rule out the signature', icon: 'radio', talksTo: 'taker', check: check(TALK, 3), minutes: 3, certBonus: NEGOTIATOR,
          summary: '{lead} tells {taker.first} plainly that nobody can make {owner.first} sign. Not you, not command, not a court. It is the truth, and it takes away the one thing {taker.he} came for. {taker.He} may stop talking to people who can’t deliver it.',
          pull: 'Tell the truth now, before {taker.first} builds on a hope.',
          cost: '{taker.first} may hang up on anyone who can’t get {taker.him} that signature.',
          preview: { favorable: '{taker.first} goes quiet, then asks what else you can do.', mixed: 'The talking goes on, but nobody walks out.', adverse: '{taker.first} stops answering and might aim at {owner.first}.' },
          outcomes: {
            favorable: [{ text: '{taker.first} says nothing for a long minute. The team can hear the drinks cooler and someone’s watch. Then {taker.he} {taker~asks|ask}, so low the negotiator leans in, what the team actually can do for {taker.him}.', moves: { taker: 'honest' }, next: { node: 'talking' }, objective: 12 }],
            mixed: [{ text: '{taker.first} says {taker.he} can wait, because people change their minds and {owner.first} will too. Both of them stay inside, and {taker.first} pulls up the second stool.', moves: { taker: 'honest' }, next: { node: 'standoff' }, objective: 6 }],
            adverse: escalate({
              lead: 'The line drops in the middle of the answer.',
              threat: 'An officer on the sidewalk sees the handgun pointed at {owner.first}.',
              quiet: '{taker.first} is slumped against the shelves, the handgun resting on {taker.his} knee.',
              extra: { mark: ['withdrawn'], moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'offer_record', title: 'Offer a written account instead', icon: 'handover', talksTo: 'taker', check: check(TALK), minutes: 5, authority: { concede: 'statement' },
          summary: 'You offer {taker.first} {taker.his} own words on paper, written down by the negotiator and sent up the line with command behind it. It is real, and it is less than the signature {taker.he} asked for. {taker.He} will know the difference.',
          pull: 'Something true you can actually give, in place of the signature.',
          cost: 'It is less than {taker.first} asked for, and {taker.he} {taker~knows|know} it.',
          preview: { favorable: '{courier.first} walks free while {taker.first} tells {taker.his} side.', mixed: '{taker.first} takes the deal, but only with {owner.first} listening.', adverse: '{taker.first} says writing isn’t signing, and {owner.first} may end up in the line of fire.' },
          outcomes: {
            favorable: [{ text: '{taker.first} starts with {taker.his} first day at that counter, a borrowed apron and a register that jammed on every receipt. Somewhere around the third year {taker.he} {taker~tells|tell} {courier.first} to go home. {taker.He} {taker~doesn’t|don’t} stop telling it.', safe: ['courier'], mark: ['account'], moves: { taker: 'released' }, next: { node: 'talking' }, objective: 30 }],
            mixed: [{ text: '{taker.first} agrees to give {taker.his} side, but only on the speaker, with {owner.first} sitting there hearing every word of it. {owner.first} looks at the floor the whole time.', mark: ['account'], moves: { taker: 'heard' }, next: { node: 'talking' }, objective: 12 }],
            adverse: escalate({
              lead: '“Paper isn’t a signature,” {taker.first} tells the negotiator.',
              threat: 'Inside, the handgun swings toward the stool.',
              quiet: 'The receiver goes face down on the counter.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'talking', stage: 'resolve',
      threat: { label: 'The regulars start filming', minutes: 5, text: 'At the tape the regulars hold their phones up. {taker.first} sees them through the glass and turns {taker.his} back on the street.', pressure: 4 },
      prompt: 'The negotiator still has the line open, and {taker.first} has stopped pacing. {owner.first} hasn’t left {owner.his} stool since this started and keeps both hands flat on the counter, where {taker.first} can see them.',
      exchange: [{ by: 'taker', line: 'You writing this down?' }, { by: 'negotiator', line: 'Every word. Go on.' }],
      promptIf: [
        { when: { marks: ['cousin_seen'] }, prompt: '{taker.first} saw {cousin.first} hauled back from the curb and hasn’t looked toward the street since. {owner.first} hasn’t moved from the stool.' },
        { when: { marks: ['lied_sign'] }, prompt: '{courier.first} is out on your word. The pen sits on top of the pad, waiting for {owner.first}’s name, and {owner.first} hasn’t been told what you promised.',
          exchange: [{ by: 'taker', line: 'You said {owner.he}’d sign. Put {owner.him} on.' }, { by: 'radio', line: 'Owner hasn’t touched the pen.' }] },
        { when: { marks: ['owner_admits'] }, prompt: '{taker.first} hasn’t put the receiver down since {owner.first} said it. Six years, a firing and a day like this one, and the money was behind the safe. Neither of them is looking at the other.',
          exchange: [{ by: 'taker', line: '{owner.He} found it the same night.' }, { by: 'negotiator', line: 'And you’ve carried it since.' }] },
        { when: { marks: ['camera_said'] }, prompt: '{taker.first} won’t turn toward the till anymore. The camera above the door has a red light on it that nobody noticed before, and now nobody inside can stop noticing it.',
          exchange: [{ by: 'taker', line: 'It was going back Friday.' }, { by: 'negotiator', line: 'Tell me about that.' }] },
        { when: { marks: ['owner_chose'] }, prompt: '{taker.first} keeps glancing at {owner.first}, who chose to stay when {owner.he} could have walked. {taker.He} {taker~asks|ask} the negotiator, twice, why anybody would do that.' },
        { when: { marks: ['owner_unwell'] }, prompt: '{owner.first} is sitting on the tiles near the till while the call goes on.' },
        { when: { marks: ['wants_back'] }, prompt: 'The alley door is the exit {taker.first} asked for. {owner.first} waits behind the register.' },
        // What the team saw from the glass (saw_inside is set only by a favorable look, team_glass or
        // glass_group; armedRevealErrors checks every call, lone ones included):
        // the coworkers' weapons, kept per call by how many hold one (TreeState.armed).
        { when: { count: { role: 'others', min: 1, max: 1 }, notMarks: ['others_out'], marks: ['saw_inside'], armed: { role: 'others', min: 1 } }, prompt: 'You saw {others.first} pull a steel bar from under the counter. {courier.first} hasn’t left the boxes.' },
        { when: { count: { role: 'others', min: 2 }, notMarks: ['others_out'], marks: ['saw_inside'], armed: { role: 'others', min: 2 } }, prompt: 'You watched both coworkers take steel bars from under the counter. {courier.first} sits by the street door.' },
        { when: { count: { role: 'others', min: 2 }, notMarks: ['others_out'], marks: ['saw_inside'], armed: { role: 'others', min: 1 } }, prompt: 'One coworker has a steel bar now, within reach of {owner.first}. {courier.first} waits near the entrance.' },
        { when: { marks: ['owner_hidden'], notMarks: ['owner_back'] }, prompt: '{owner.first} is behind the shelves now, out of sight of the glass. {courier.first} sits tight by the door.' },
        { when: { notSafe: ['courier'] }, prompt: 'The negotiator has {taker.first} talking. {courier.first} is near the entrance, and {owner.first} is by the till.' },
        { when: { ...GROUP, marks: ['others_out'] }, prompt: 'With {others} gone, {taker.first} is alone in there with {owner.first} and the phone.' },
        { when: GROUP_IN, prompt: 'The receiver is in {taker.first}’s hand. {others} {others#hovers|hover} near {owner.first}.' },
      ],
      choices: [
        { id: 'own_up', title: 'Tell {taker.him} {owner.first} won’t sign', icon: 'radio', talksTo: 'taker', check: check(TALK, 2), minutes: 3, onlyIf: { marks: ['lied_sign'] },
          summary: '{lead} takes the promise back before {owner.first} has to say no to {taker.his} face. It is the truth, late. {taker.first} will know the negotiator lied to {taker.him} to get the courier out, and will decide what that means.',
          pull: 'Own the lie yourself before it lands on {owner.first}.',
          cost: '{taker.first} learns the negotiator lied to {taker.him}.',
          preview: { favorable: '{taker.first} hears it from you first, and makes up {taker.his} mind about {owner.first}.', mixed: '{taker.first} stops believing a word the negotiator says.', adverse: '{taker.first} hears that you lied, with {owner.first} within reach of the handgun.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} doesn’t answer for a long while. There is only the ballgame on the line, and then not even that. Then {taker.he} {taker~points|point} {owner.first} to the street door, and {owner.first} goes without being told twice.', exchange: [{ by: 'taker', line: 'First true thing anybody’s said to me all day.' }],
                breaks: ['will_sign'], mark: ['lie_found'], reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'honest' }, next: { node: 'last_one' }, objective: 45 },
              { if: KEEPS, text: '{taker.first} says {taker.he} knew it, and leaves the pen lying on the pad.', breaks: ['will_sign'], mark: ['lie_found'], reveal: ['lets_go'], moves: { taker: 'honest' }, next: { node: 'standoff' }, objective: 8 },
            ],
            mixed: [{ text: '{taker.first} says every word from the team is worth nothing now, and that {taker.he} should have known it the first time. {owner.first} stays at the till, and the pad goes into the trash under the counter.', breaks: ['will_sign'], mark: ['lie_found'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 4 }],
            adverse: escalate({
              lead: '{taker.first} hears that there was never going to be a signature.',
              threat: '{taker.He} {taker~turns|turn} the handgun on {owner.first}, as if {owner.he} had lied too.',
              anyway: '{taker.He} {taker~has|have} been lied to once too often today. {owner.first} is looking down the barrel.',
              quiet: '{taker.first} drops the receiver on the counter and walks away from it.',
              extra: { breaks: ['will_sign'], mark: ['lie_found'], moves: { taker: 'provoked' }, pressure: 8 } }),
          } },
        { id: 'take_account', title: 'Take down {taker.his} account', icon: 'handover', talksTo: 'taker', check: check(TALK), minutes: 6, onlyIf: { notMarks: ['account'] }, authority: { concede: 'statement' },
          modifiers: [{ label: '{courier.first} filled you in', mark: 'knows_story', value: 6 }, { label: '{owner.first} spoke for {owner.himself}', mark: 'owner_heard', value: 4 },
            { label: '{owner.first} said {owner.he} {owner~was|were} wrong', mark: 'owner_admits', value: 6 }, { label: 'You know it’s {owner.first}’s birthday', mark: 'birthday', value: 4 }],
          summary: '{lead} writes down every word as {taker.first} talks, and reads it back, line by line, so it can go to command as {taker.his} own words. It is the one thing you can honestly give. The account settles nothing about the till, though, and {taker.he} will hear that too.',
          pull: 'Something real on paper that is entirely {taker.his}.',
          cost: 'It clears nobody, and {taker.first} may want more than a record.',
          preview: { favorable: 'You get the whole account down, and {taker.first} makes a decision about {owner.first}.', mixed: 'The account gets finished, but the handgun never leaves {taker.first}’s hand.', adverse: '{taker.first} wants you to side against {owner.first}. Refusing could put {owner.first} in danger.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'Six years at the counter go into the officers’ notes, every shift {taker.first} can remember and a few {taker.he} can’t. When it is read back, {taker.he} {taker~sets|set} the handgun down beside the register and {taker~sends|send} {owner.first} out. Officers call {taker.him} out next, the way they tell {taker.him} to, and take {taker.him} at the door.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, ...surrender('everyone_out'), objective: 80, pressure: -10 },
              courierToo('{courier.first} walks out beside {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: 'Once every word is down and read back, {taker.first} says it is a good page, the best anybody has written about {taker.him}. Then {taker.he} {taker~adds|add} that it changes nothing until {owner.he} {owner~signs|sign} it.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 12 },
            ],
            mixed: [
              { if: LETS_GO, text: 'When the account is complete, {taker.first} lets {owner.first} leave, and {owner.first} stops once at the door as if to say something and then doesn’t. {taker.first} keeps a grip on the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} follows {owner.first} out into the street.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} makes the negotiator read the account back on the speaker, twice, so {owner.first} has to sit and listen to every line. {owner.He} {owner~stays|stay} put, and nobody signs anything.', reveal: ['lets_go'], mark: ['account'], next: { node: 'standoff' }, objective: 10 },
            ],
            adverse: [foundOut('{taker.first} holds the pen out to {owner.first} over the speaker. {owner.first} won’t take it, and the negotiator’s promise goes with it.'), ...escalate({
              lead: '{taker.first} asks the team to agree {owner.first} lied about the till. The team won’t.',
              threat: 'The handgun comes up at {owner.first}. The officer at the side window radios it in.',
              anyway: 'One refusal too many, and {owner.first} is suddenly at the wrong end of the handgun.',
              quiet: '{taker.first} says the statement will wait for {owner.first}’s name.',
              extra: { moves: { taker: 'provoked' }, pressure: 6 } })],
          } },
        // The reframe in stage 3 (review F1): the owner on the speaker, with the taker hearing every word.
        { id: 'owner_speaker', title: 'Put {owner.first} on the speaker', icon: 'radio', check: check(TALK, 2), minutes: 4, onlyIf: { notMarks: ['owner_heard'] },
          modifiers: [{ label: '{taker.His} account is written down', mark: 'account', value: 6 }],
          summary: '{lead} asks whether {owner.first} wants to speak, with {taker.first} holding the receiver out at arm’s length. {owner.first} has had an hour to think about that till. {taker.first} will hear all of it, at the same moment you do.',
          pull: 'Let the person who counted the drawer say what {owner.he} found.',
          cost: 'Whatever {owner.first} says, it lands on {taker.first} with no one to soften it.',
          preview: { favorable: '{owner.first} talks about that drawer, and {taker.first} answers {owner.him}.', mixed: '{owner.first} starts to talk, then the receiver is pulled back.', adverse: '{taker.first} keeps the phone from {owner.first}. The handgun is a foot from {owner.him}.' },
          outcomes: {
            favorable: [
              { if: { fact: 'owner_wrong', is: true }, text: '{owner.first} tells the speaker about the deposit bag behind the safe, and the night {owner.he} found it, and the phone {owner.he} picked up three times and put down. {taker.first} listens to all of it. Then {taker.he} {taker~walks|walk} to the street door and {taker~opens|open} it for {owner.him}.',
                exchange: [{ by: 'owner', line: 'I should have called you that night.' }, { by: 'taker', line: 'Go on. Go home.' }],
                reveal: ['owner_wrong'], safe: ['owner'], mark: ['owner_heard', 'owner_admits'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 50 },
              courierToo('{courier.first} goes through the door right behind {owner.first}.', { if: { fact: 'owner_wrong', is: true } }),
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} gets three words out and stops, short of breath, one hand on {owner.his} chest. {owner.He} won’t say who closed out that drawer that night. {taker.first} works it out anyway, from the silence.',
                exchange: [{ by: 'owner', line: 'Ask me anything but who.' }, { by: 'taker', line: 'Then I know who.' }],
                reveal: ['owner_faint'], mark: ['owner_heard', 'owner_unwell'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 8 },
              { if: { fact: 'took_it', is: true }, text: '{owner.first} says the camera saw the drawer that night, and that {owner.he} watched the tape twice. {taker.first} cuts the speaker off before {owner.he} can finish, and the place goes quiet in a different way.',
                exchange: [{ by: 'owner', line: 'I never showed it to anyone.' }, { by: 'taker', line: 'Enough.' }],
                reveal: ['took_it'], mark: ['owner_heard', 'camera_said'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 8 },
              foundOut('{owner.first} also says {owner.he} never agreed to sign anything, and {taker.first} hears that too.'),
            ],
            mixed: [
              { text: '{owner.first} starts on the till count, the twenties and the tens, slow and careful. {taker.first} takes the receiver back before the end, as if {taker.he} {taker~knows|know} how it finishes and can’t hear it again.', mark: ['owner_heard'], next: { node: 'standoff' }, objective: 4 },
              foundOut('{owner.first} gets one sentence out, that {owner.he} never said {owner.he} would sign.'),
            ],
            adverse: [foundOut('{taker.first} wants to hear {owner.first} promise to sign first. {owner.first} shakes {owner.his} head.'), ...escalate({
              lead: '{taker.first} keeps the receiver pressed against {taker.his} chest.',
              threat: 'Then the handgun turns on {owner.first} instead.',
              quiet: '{owner.first} stays on the stool, and the speaker stays off.',
              extra: { moves: { taker: 'provoked' }, pressure: 8 } })],
          } },
        // After the owner has spoken (owner_speaker or owner_voice), asking for the owner outright.
        { id: 'ask_owner', title: 'Ask for {owner.first} now', icon: 'radio', talksTo: 'taker', check: check(TALK, 6), minutes: 2, onlyIf: { ...LONE, marks: ['owner_heard'], notMarks: ['door_open'] },
          modifiers: [{ label: '{taker.His} account is written down', mark: 'account', value: 8 }],
          summary: '{owner.first} has spoken, and {lead} uses it, pressing for {owner.him} now and offering nothing new in return. After what was said, it might be enough. {taker.first} may also hear it as an order, from people who keep telling {taker.him} what to do.',
          pull: 'After what was said, one push might be enough.',
          cost: '{taker.first} may hear it as one more order.',
          preview: { favorable: '{taker.first} makes up {taker.his} mind about {owner.first} on the spot.', mixed: '{taker.first} keeps hold of the handgun, and maybe {owner.first} too.', adverse: '{taker.first} hears a demand, and the handgun may come up toward {owner.first}.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'After a moment, {taker.first} waves {owner.first} toward the door. {owner.He} {owner~walks|walk} out without {owner.his} coat, past the shelves and the humming cooler, and doesn’t look back until the cold air hits {owner.him}.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} is a step behind {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} repeats, word for word, that {owner.first} puts {owner.his} name down first. Then {taker.he} {taker~hangs|hang} up on the next question before it is finished.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 5 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} releases {owner.first} but keeps to the counter, still gripping the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} is a pace ahead of {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} says {owner.first} isn’t going anywhere because somebody on a phone said so. {owner.first} sits back down and folds {owner.his} hands on the counter.', reveal: ['lets_go'], mark: ['owner_back'], next: { node: 'standoff' } },
            ],
            adverse: [foundOut('{taker.first} tells {owner.first} to sign now, since the negotiator said {owner.he} would. {owner.first} says nobody asked {owner.him}.'), ...escalate({
              lead: '“Nobody gives me orders,” {taker.first} says.',
              threat: 'From the side window, an officer sees {taker.him} take aim at {owner.first}.',
              anyway: '{taker.first} has taken one push too many and thrusts the handgun out toward {owner.first}.',
              quiet: '{taker.He} {taker~stops|stop} picking up after that.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } })],
          } },
        { id: 'others_walk_owner', title: 'Let {others.first} see {owner.first} out', icon: 'door', talksTo: 'taker', check: check(TALK, 2), minutes: 3, onlyIf: GROUP_IN,
          modifiers: [{ label: 'The account is on paper', mark: 'account', value: 6 }],
          summary: '{lead} proposes that {owner.first} leave with {others}, walking out together, a way to let everyone go that doesn’t look like losing. If {taker.first} says no, {taker.he} also {taker~learns|learn} you are after {taker.his} people too.',
          pull: '{owner.first} out with people {taker.first} trusts beside {owner.him}.',
          cost: 'A refusal tells {taker.first} you are working on {taker.his} people.',
          preview: { favorable: '{others} {others#guides|guide} {owner.first} out, or {taker.first} sends {others.him} off alone.', mixed: '{others} {others#ends|end} up at the till beside {taker.first}, who keeps the handgun.', adverse: '{taker.first} turns on all of them, and {owner.first} is the nearest.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'At a nod from {taker.first}, {others} {others#brings|bring} {owner.first} through the street door, and officers meet them outside.', reveal: ['lets_go'], safe: ['owner'], out: ['others'], mark: ['others_out'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 48 },
              courierToo('{courier.first} comes along behind them.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} tells {others} to go if {others.he} {others~wants|want}, but {owner.first} stays. The street door shuts behind {others.him}.', reveal: ['lets_go'], out: ['others'], mark: ['others_out'], next: { node: 'standoff' }, objective: 14 },
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
          summary: 'The landlord’s spare key fits. Officers unlock the street door without a sound while {lead} keeps {taker.first} talking about anything at all. It only takes {owner.first} four steps. It only takes one glance up from {taker.first}, too.',
          pull: '{owner.first} out in four steps, without asking anyone.',
          cost: 'One glance up and {owner.first} is in the doorway, in plain sight.',
          preview: { favorable: '{owner.first} is outside before {taker.first} looks up.', mixed: '{owner.first} makes it, and {taker.first} sees the door swing shut.', adverse: '{taker.first} looks up as the door opens, with {owner.first} still in reach.' },
          outcomes: {
            favorable: [{ text: '{owner.first} slips out while {taker.first} is still talking about the till. {taker.He} only {taker~stops|stop} when the little bell over the door rings, and then {taker.he} {taker~stands|stand} looking at the empty stool for a long time without saying anything at all.', safe: ['owner'], next: { node: 'last_one' }, objective: 45 }],
            mixed: [{ text: '{owner.first} is gone through the door. {taker.first} sees it close and shouts that the team tricked {taker.him}, the handgun in {taker.his} fist.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'provoked' }, next: { node: 'last_one' }, objective: 38 }],
            adverse: escalate({
              lead: 'The bell jangles, and {taker.first} glances up.',
              threat: '{taker.He} {taker~swings|swing} the handgun toward {owner.first} in the doorway.',
              anyway: '{taker.He} {taker~yells|yell} that everyone is lying to {taker.him} and {taker~covers|cover} {owner.first} with the handgun.',
              quiet: '{taker.He} {taker~calls|call} {owner.first} back, and {owner.he} {owner~sits|sit} down on the stool again.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        { id: 'back_deal', title: 'Trade the alley for {owner.first}', icon: 'handover', talksTo: 'taker', check: check(TALK, -2), minutes: 4, onlyIf: { marks: ['wants_back'] }, authority: { concede: 'surrender_terms' },
          summary: 'You offer {taker.first} the alley, the exit {taker.he} asked for, out of sight of the regulars at the tape, once {owner.first} is out the front. Command has signed off on it. Any hint that the back is a setup ends {taker.his} trust in you for good.',
          pull: 'The thing {taker.first} wanted most, short of the signature.',
          cost: 'If it smells like a trap, you lose {taker.first} for good.',
          preview: { favorable: '{taker.first} takes the alley and makes a choice about {owner.first}.', mixed: '{taker.first} agrees to the back way but keeps the handgun for now.', adverse: '{taker.first} hears a trick, and {owner.first} is the one in reach.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'The negotiator has to say it twice. Then {taker.first} nods {owner.first} toward the front, and {owner.he} {owner~goes|go}.', reveal: ['lets_go'], safe: ['owner'], mark: ['back_promised'], promise: { id: 'back_door', to: 'taker', kind: 'surrender_terms' }, moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 48 },
              courierToo('{courier.first} leaves the same way.', { if: LETS_GO }),
              { if: KEEPS, text: 'The alley suits {taker.first}, and {taker.he} {taker~says|say} so. Then {taker.he} {taker~slides|slide} the pad back toward {owner.first}. The signature still comes first.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 10 },
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
        { id: 'alley_talk', title: 'Talk at the alley door', icon: 'radio', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'taker' } }, talksTo: 'taker', check: check(TALK, -6), minutes: 5, stress: 4, consequenceLevel: 'high', onlyIf: { marks: ['team_close'] },
          summary: '{lead} talks with {taker.first} face to face through the gap in the steel door out back, near enough to see {taker.his} eyes.  Only the steel frame stands between {lead} and the handgun.',
          pull: 'A face instead of a phone, and a chance to read it.',
          cost: '{lead} stands a door frame away from the handgun.',
          preview: { favorable: '{taker.first} talks face to face and makes a call on {owner.first}.', mixed: '{taker.first} comes close, then backs off with {taker.his} handgun up.', adverse: 'A shot could come through the opening and hit whoever is at the gap.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'For ten minutes {taker.first} talks through the gap in the alley door, mostly about the regulars, the regular who pays in coins, the twins who never say thanks. Then {taker.he} {taker~calls|call} back into the place that {owner.first} can use the front, and nobody argues.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 50, pressure: -10 },
              courierToo('{courier.first} goes out at {owner.first}’s side.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} talks through the crack in the door until {taker.his} voice gives out a little, then walks back to the counter. Over {taker.his} shoulder {taker.he} {taker~says|say} {owner.he} still {owner~owes|owe} a signature, as if reminding {taker.himself}.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 12 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} sees the rest of the team behind the officer and retreats, armed and shouting. {taker.He} {taker~lets|let} {owner.first} go anyway.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'team_seen' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} is out ahead of everyone.', { if: LETS_GO }),
              { if: KEEPS, text: 'At the sight of more officers in the alley, {taker.first} retreats to {owner.first}.', reveal: ['lets_go'], moves: { taker: 'team_seen' }, next: { node: 'standoff' }, pressure: 6 },
            ],
            adverse: [{ text: '{taker.first} comes to the back shouting and fires through the gap, then bolts the door.', fire: { from: 'taker' }, mark: ['shot_at_team'], moves: { taker: 'shots', others: 'shots' }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        { id: 'last_day', title: 'Ask about {taker.his} last day', icon: 'radio', talksTo: 'taker', check: check(TALK, -4), minutes: 7, onlyIf: { marks: ['knows_story'] },
          summary: '{courier.first} said {taker.first} kept starting the story of that final day and never finishing it. {lead} asks {taker.him} to tell it start to finish, all of it. {owner.first} has to hear it all again, three feet away.',
          pull: 'Let {taker.first} finish the story {taker.he} {taker~keeps|keep} starting.',
          cost: '{owner.first} sits through that day again, three feet away.',
          preview: { favorable: 'You hear the day {taker.first} keeps starting, and then {taker.he} {taker~decides|decide} about {owner.first}.', mixed: '{taker.first} stops at the moment {owner.first} accused {taker.him}.', adverse: '{taker.first} hears pity in the question, and {owner.first} takes the brunt.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} tells the day from the first customer to the till count, the coffee, the delivery that came late, the moment the count came up short. When {taker.he} {taker~reaches|reach} the end there is a long pause. Then {taker.he} {taker~says|say} {owner.first} is free to go.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 50, pressure: -10 },
              courierToo('{courier.first} walks out next to {owner.first}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} stops halfway through the day. Then {taker.he} {taker~says|say} {taker.he} took the money for the rent, and still {taker~wants|want} {owner.first} to sign a page that says otherwise.',
                exchange: [{ by: 'taker', line: 'I’d have had it back by Friday.' }], reveal: ['lets_go', 'took_it'], moves: { taker: 'heard' }, next: { node: 'standoff' }, objective: 14 },
            ],
            mixed: [{ text: 'The story stops at the count, the same place it has stopped every time today. {owner.first} knows the rest, according to {taker.first}, and can tell it if {owner.he} {owner~wants|want} to. {owner.first} doesn’t.', moves: { taker: 'heard' }, next: { node: 'standoff' }, objective: 8 }],
            adverse: [...escalate({
              lead: '{taker.first} says {taker.he} {taker~doesn’t|don’t} need anyone feeling sorry for {taker.him}, least of all on the phone, least of all today.',
              threat: 'Officers outside see the handgun come up at {owner.first}.',
              anyway: 'Too much has gone wrong today. {taker.He} {taker~aims|aim} over the register at {owner.first}.',
              quiet: 'After that {taker.he} {taker~goes|go} quiet and won’t pick up.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } })],
          } },
        { id: 'his_door', title: 'Use the door {taker.he} unlocked', icon: 'door', talksTo: 'taker', check: check(TALK, -2), minutes: 3, onlyIf: { marks: ['door_open'] },
          summary: 'That front door is unbolted because you asked, and {taker.first} did it. {lead} asks for it to be used now, for {owner.first}. A no, after that, would be said straight to your face.',
          pull: 'A door {taker.first} already opened, used for the one thing that matters.',
          cost: 'A refusal now hardens everything after it.',
          preview: { favorable: 'The front stays unbolted, and {taker.first} gives you a straight answer.', mixed: '{taker.first} turns the bolt again, whatever happens to {owner.first}.', adverse: 'The front gets locked again, and {owner.first} could be next.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} walks {owner.first} to the front, a hand hovering near {owner.his} elbow and never touching it. Then {taker.he} {taker~holds|hold} the door open for {owner.him}, the way {taker.he} must have held it for a thousand customers.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 48 },
              courierToo('{courier.first} goes out after {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} says that door is for when {owner.first} signs, and not a minute before. {taker.He} {taker~leaves|leave} it unbolted anyway, and the team notices.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 10 },
            ],
            mixed: [
              { if: LETS_GO, text: '{taker.first} lets {owner.first} out, then turns the lock behind {owner.him}, still holding the handgun.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 42 },
              courierToo('{courier.first} squeezes out just before the lock turns.', { if: LETS_GO }),
              { if: KEEPS, text: 'The front is bolted again. Nobody uses that door until {owner.first} signs.', reveal: ['lets_go'], next: { node: 'standoff' }, pressure: 4 },
            ],
            adverse: [...escalate({
              lead: 'The bolt goes back across.',
              threat: 'Then the handgun is trained on {owner.first}.',
              anyway: '{taker.first} has nothing to trade now and raises the handgun toward the stool.',
              quiet: 'The counter phone goes dead, unplugged at the wall.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } })],
          } },
        // The camera as a gamble: nobody on your side knows what the tape shows (each situation answers it differently).
        { id: 'camera_bluff', title: 'Tell {taker.him} about the camera', icon: 'radio', talksTo: 'taker', check: check(TALK, 2), minutes: 3, onlyIf: { marks: ['camera_seen'] },
          summary: 'There is a camera over the door, aimed at the register. {lead} tells {taker.first} you know it is there and asks what it would show from that last shift. Nobody on your side knows the answer. {taker.first} knows, and so does {owner.first}.',
          pull: 'Make the one witness nobody mentioned part of the conversation.',
          cost: 'You don’t know what the tape shows, and both of them do.',
          preview: { favorable: '{taker.first} answers the question about the tape, and it changes what this is about.', mixed: '{taker.first} and {owner.first} both go quiet about the camera, for different reasons.', adverse: 'The camera turns into an accusation, and {owner.first} is the one within reach.' },
          outcomes: {
            favorable: [
              { if: { fact: 'owner_wrong', is: true }, text: '{taker.first} laughs once, short and surprised. The tape would show {taker.him} counting that drawer twice and putting every bill back, {taker.he} {taker~says|say}. Then {taker.he} {taker~asks|ask} {owner.first} if {owner.he} ever watched it. {owner.first} shakes {owner.his} head, and {taker.first} tells {owner.him} to go home.',
                reveal: ['owner_wrong'], safe: ['owner'], mark: ['owner_admits'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 50 },
              { if: { fact: 'owner_faint', is: true }, text: '{owner.first} answers before {taker.first} can. {owner.He} {owner~says|say} the footage shows who closed out that night, and it wasn’t {taker.first}. {taker.first} lowers the handgun an inch at a time, then unbolts the door and asks for a medic for {owner.first}, now.',
                reveal: ['owner_wrong', 'owner_faint'], safe: ['owner'], mark: ['owner_unwell'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} follows {owner.first} out without being told.', { if: LETS_GO }),
              { if: { fact: 'took_it', is: true }, text: '{taker.first} goes completely still. Then {taker.he} {taker~says|say} {taker.he} took it, all three hundred and forty, for the rent. The camera has been dead since spring, and {owner.first} knew that too. {owner.first} doesn’t contradict a word.',
                reveal: ['took_it'], mark: ['camera_said'], moves: { taker: 'honest' }, next: { node: 'standoff' }, objective: 14 },
            ],
            mixed: [{ text: '{taker.first} says the camera hasn’t worked in months. {owner.first} says nothing at all. Nobody outside can tell which of them is right, and both of them know it.', mark: ['camera_said'], next: { node: 'standoff' }, objective: 6 }],
            adverse: escalate({
              lead: '{taker.first} hears “tape” and “last shift” and decides the team has already made up its mind about {taker.him}.',
              threat: '{taker.He} {taker~points|point} the handgun at {owner.first} and tells {owner.him} to say what the tape shows.',
              anyway: '{taker.first} is past listening and holds the handgun on {owner.first}, demanding the truth from {owner.him}.',
              quiet: '{taker.first} pulls the camera off its bracket and throws it into the back room.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        // The crew layer: an impatient officer wants the phone.
        { id: 'push_hard', title: 'Let your fastest talker push', icon: 'radio', talksTo: 'taker', check: check(TALK, 4), minutes: 2, stress: 3, onlyIf: { crew: ['impatient'] },
          summary: 'The most impatient officer in your squad wants the phone, and the case is simple. {owner.first} has been on that stool too long already. Pushing gets answers fast. It also means quick words, landing on someone {owner.first} accused in front of the regulars.',
          pull: 'An answer now, before anything else goes wrong.',
          cost: 'Fast words, and the wrong one could land on {owner.first}.',
          preview: { favorable: '{taker.first} answers fast and decides about {owner.first} on the spot.', mixed: '{owner.first} gets out, and {taker.first} keeps the handgun and a grudge.', adverse: 'One wrong word lands hard, and {owner.first} is standing closest.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} doesn’t have time to dig in. Thirty seconds of short questions and shorter answers, and {taker.he} {taker~tells|tell} {owner.first} to get out before {taker.he} {taker~changes|change} {taker.his} mind.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} is out the door a step ahead of {owner.first}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} answers every question with the same three words. {owner.His} name, signed. The faster the questions come, the slower {taker.he} {taker~says|say} them.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 6 },
            ],
            mixed: [
              { if: LETS_GO, text: '{owner.first} gets out. {taker.first} keeps the handgun and tells the negotiator {taker.he} won’t speak to that officer again, not tonight, not ever.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'provoked' }, next: { node: 'last_one' }, objective: 38 },
              courierToo('{courier.first} goes out right behind {owner.first}.', { if: LETS_GO }),
              { if: KEEPS, text: '{taker.first} stops answering the fast questions and starts answering slower ones nobody asked, about the till, about the regulars, about yesterday.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 4 },
            ],
            adverse: escalate({
              lead: 'The officer says nobody out here thinks {taker.first} is a thief. {taker.first} hears only the last word.',
              threat: '{taker.He} {taker~swings|swing} the handgun up at {owner.first} and holds it there.',
              anyway: 'The word does its damage. {taker.first} has the handgun on {owner.first} before anyone can take it back.',
              quiet: '{taker.first} hangs up and doesn’t take the next six calls.',
              extra: { moves: { taker: 'provoked' }, pressure: 10 } }),
          } },
        // Care through the door (owner 2026-10-20: assets change how a call goes). The medic's kit holds
        // the owner's heart steady, and the officer carrying it stands at the glass to do it.
        { id: 'medic_bag', title: 'Talk {taker.him} through the medic’s kit', icon: 'door', team: { to: { vantage: 'scene' } }, talksTo: 'taker', check: check(TREAT, 2), minutes: 4, consequenceLevel: 'high', onlyIf: { marks: ['owner_unwell'], notMarks: ['owner_steady'] },
          certBonus: { cert: 'advanced_first_aid', value: 8, label: 'Advanced first aid' },
          summary: '{lead} carries the medic’s bag to the front door and talks {taker.first} through it step by step, the aspirin, the cuff, how to sit {owner.first} up. Your officer stands an arm’s length from the glass, and {taker.first} needs both hands for the kit.',
          pull: '{owner.first}’s heart, held steady by your officer’s voice.',
          cost: 'Your officer stands at the glass, and {taker.first} decides how close is too close.',
          preview: { favorable: '{taker.first} does what your officer says, and {owner.first} steadies.', mixed: '{owner.first} gets the aspirin, and {taker.first} keeps the kit and the door.', adverse: '{taker.first} takes the officer at the door for a trick, and {owner.first} may pay for it.' },
          outcomes: {
            favorable: [
              { if: OWNER_OK, text: '{taker.first} kneels by the stool with the cuff and reads the numbers back through the door, one at a time. {owner.first} chews the aspirin and sits with {owner.his} back to the counter. The handgun stays on the shelf for all of it.', stabilize: ['owner_condition'], mark: ['owner_steady'], moves: { taker: 'heard' }, next: { node: 'standoff' }, objective: 14, pressure: -6 },
              { if: OWNER_OK, when: { lead: ['band_veteran'] }, text: 'The veteran at the door keeps {taker.first} reading the numbers aloud, so {taker.his} hands stay on the cuff.' },
              // Too late: the clock ran out while the kit was on its way (a fork reads this decision's minutes).
              { if: OWNER_OUT, text: 'The cuff is only half on when {owner.first} slides off the stool and stops answering. {taker.first} is yelling for the medic, both fists on the door.', next: { node: 'owner_down' } },
            ],
            mixed: [
              { if: OWNER_OK, text: '{taker.first} pulls the kit in through the door and shuts it on the officer’s glove. Through the glass, the aspirin reaches {owner.first}. The kit stays inside, and so does everyone else.', stabilize: ['owner_condition'], mark: ['owner_steady'], moves: { taker: 'provoked' }, next: { node: 'standoff' }, objective: 8, pressure: 4 },
              { if: OWNER_OUT, text: '{taker.first} drags the kit inside and slams the door. By the time the bag is open, {owner.first} is down on the tiles.', moves: { taker: 'provoked' }, next: { node: 'owner_down' } },
            ],
            adverse: [
              { when: { lead: ['rookie'] }, text: 'The rookie carrying the kit flinched when the door moved, and {taker.first} saw the flinch.' },
              ...escalate({
                lead: '{taker.first} sees the officer at the glass, not the kit, and kicks the door shut on both.',
                threat: '{taker.first} puts the handgun against {owner.first}’s shoulder and tells the officer to back off the step.',
                quiet: '{taker.first} drags {owner.first}’s stool behind the counter, out of sight of the door.',
                extra: { moves: { taker: 'team_seen' }, pressure: 8 } }),
            ],
          } },
        { id: 'his_pace', title: 'Let {taker.first} set the pace', icon: 'wait', talksTo: 'taker', check: check(HOLD, -6), minutes: 30, span: 'Hours',
          summary: '{lead} stays on the line as long as {taker.first} wants, hours if it takes hours, and lets {taker.him} set every pace. {owner.first} spends every one of those hours behind the counter.',
          pull: 'Time on your side, and nothing forced.',
          cost: 'Every hour of it is spent by {owner.first}, behind the counter.',
          preview: { favorable: 'Hours pass before {taker.first} decides about {owner.first}, who may collapse first if unwell.', mixed: 'Night falls with {taker.first} still deciding. A sick {owner.first} may not hold up that long.', adverse: '{taker.first} runs out of things to say and stops answering, with {owner.first} still inside.' },
          outcomes: {
            favorable: [
              { if: [LETS_GO, OWNER_OK], text: '{taker.first} talks until the street lights come on, then for a while after that, about nothing much. Then, in the middle of a sentence about the weather, {taker.he} {taker~says|say} {owner.first} should get home before it gets any later.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 50, pressure: -8 },
              { if: [LETS_GO, OWNER_OUT], text: '{owner.first} sags off the stool two hours in and stays down. {taker.first} lets officers carry {owner.him} out and never lets go of the handgun.', reveal: ['lets_go', 'owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, next: { ending: 'owner_collapsed' }, objective: 20 },
              courierToo('{courier.first} leaves with {owner.him}.', { if: LETS_GO }),
              // The owner's clock runs only where the taker would trade (s2), so a refusal never forks on it.
              { if: KEEPS, text: 'The street lights are on, and {taker.first} still wants the signature.', reveal: ['lets_go'], next: { node: 'standoff' }, objective: 10 },
              foundOut('{taker.first} slides the pad to {owner.first} after dark. {owner.He} {owner~pushes|push} it back.', { if: KEEPS }),
            ],
            mixed: [
              { if: [LETS_GO, OWNER_OK], text: '{taker.first} lets {owner.first} go after dark, with the handgun still across {taker.his} lap.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 42, minutes: 20 },
              { if: [LETS_GO, OWNER_OUT], text: 'After dark {owner.first} stops answering when the team asks for {owner.him}. {taker.first} opens up, and two officers bring {owner.him} out gray and barely awake.', reveal: ['lets_go', 'owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, next: { ending: 'owner_collapsed' }, objective: 16, minutes: 20 },
              courierToo('{courier.first} is let go an hour before {owner.him}.', { if: LETS_GO }),
              { if: KEEPS, text: 'The answers get shorter as the evening wears on. {owner.first} is still in there.', reveal: ['lets_go'], next: { node: 'standoff' }, minutes: 20 },
            ],
            // A patient hold lowers the temperature: at worst the taker stops talking, never turns on
            // the owner. The owner's heart is another matter.
            adverse: [
              { if: OWNER_OK, text: '{taker.first} puts the phone down and doesn’t pick up again. {owner.first} is still by the register.', mark: ['owner_back', 'silent', 'withdrawn'], next: { node: 'standoff' }, minutes: 10 },
              { if: OWNER_OUT, text: 'The line goes quiet. From outside, {owner.first} can be seen on the floor, not moving.', next: { node: 'owner_down' }, minutes: 10 },
            ],
          } },
      ] },
    { id: 'standoff', stage: 'resolve',
      threat: { label: 'Dark comes down', minutes: 10, text: 'The streetlights come on along the block. Inside, {taker.first} still hasn’t sat down, and {owner.first} hasn’t left the stool.', pressure: 6, civilian: -2 },
      prompt: 'The bargaining has stopped. {owner.first} is perched on the stool behind the register with {owner.his} coat still over the back of it, and {taker.first} has stopped answering questions with anything but questions. The coat hasn’t moved either.',
      promptIf: [
        { when: { marks: ['owner_steady'] }, prompt: '{owner.first} sits against the counter with the cuff still on {owner.his} arm, and the medic’s kit is open on the floor. {taker.first} hasn’t gone back for the handgun yet.' },
        // Withdrawal is a self-harm sign (E4, the escalation palette): the negotiator asks the direct question.
        { when: { marks: ['withdrawn'] }, prompt: '{taker.first} has stopped asking for anything. {owner.first} hasn’t moved.',
          exchange: [{ by: 'negotiator', line: 'Are you thinking about hurting yourself today?' }, { by: 'taker', line: 'Doesn’t matter.' }] },
        { when: { ...LONE, marks: ['lie_found'] }, prompt: '{taker.first} knows about the lie now. {taker.He} {taker~has|have} swept the pad onto the floor.' },
        { when: { marks: ['lied_sign'] }, prompt: '{taker.first} keeps asking when {owner.first} will sign the pad.' },
        { when: { marks: ['owner_admits'] }, prompt: '{taker.first} stopped making offers after {owner.first} spoke.' },
        { when: { marks: ['camera_said'] }, prompt: '{taker.first} won’t look toward the till since the camera came up.', exchange: [{ by: 'taker', line: 'Nobody was supposed to see that.' }] },
        { when: { marks: ['owner_chose'] }, prompt: '{owner.first} chose to stay, and {taker.first} hasn’t stopped looking at {owner.him} since. The bargaining has stopped, and something else has taken its place.' },
        { when: { marks: ['owner_unwell'] }, prompt: '{owner.first} is breathing hard behind the till, and {taker.first} has stopped making offers.' },
        { when: { marks: ['owner_hidden'], notMarks: ['owner_back'] }, prompt: '{owner.first} is still out of sight behind the shelves, and {taker.first} won’t talk terms anymore.' },
        { when: { marks: ['silent'] }, prompt: 'Every call goes unanswered. {owner.first} sits at the register within {taker.first}’s reach.' },
        { when: { marks: ['sign_demand'] }, prompt: '{taker.first} insists {owner.first} signs before anyone goes anywhere. {owner.He} {owner~waits|wait} by the cash drawer.' },
        { when: { notSafe: ['courier'] }, prompt: 'The bargaining is over. {courier.first} is still near the exit, while {owner.first} keeps to the stool.' },
        { when: GROUP_IN, prompt: '{taker.first} is done making deals. {others} {others#watches|watch} the street from beside the door.' },
      ],
      choices: [
        { id: 'into_night', title: 'Talk into the night', icon: 'wait', talksTo: 'taker', check: check(HOLD, -6), minutes: 40, span: 'All night',
          summary: '{lead} rings back through the night, every half hour, the same calm voice whether {taker.first} answers or not. If {taker.first} never gives in, though, {owner.first} spends the whole night at that counter.',
          pull: 'The slowest way, and the one that ends most nights like this.',
          cost: '{owner.first} spends the night at the counter if it doesn’t work.',
          preview: { favorable: '{taker.first} answers every call through the night, and {owner.first} may walk out unsigned.', mixed: '{owner.first} may still be at the counter at dawn, and the handgun stays with {taker.first}. An ailing {owner.first} may have collapsed by then.', adverse: '{taker.first} stops answering for good, and {owner.first} could be in the worst danger yet.' },
          outcomes: {
            favorable: [
              { if: [LETS_GO, OWNER_OK], text: 'A call comes back after midnight, and {taker.first} sounds worn all the way through. {taker.He} {taker~says|say} {owner.first} can go. {owner.first} walks out unsigned, stiff from the stool, and stops on the sidewalk to look back once at the lit window.', reveal: ['owner_faint'], safe: ['owner'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              { if: [LETS_GO, OWNER_OUT], text: 'After midnight, {owner.first} lies collapsed by the till. {taker.first} unbolts the door so officers can bring {owner.him} to the medic.', reveal: ['owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, next: { ending: 'owner_collapsed' }, objective: 18 },
              courierToo('{courier.first} walks out with {owner.him}.', { if: LETS_GO }),
              ...heldEnd({ if: KEEPS, text: '{taker.first} picks up every call past midnight and says the same thing each time. {owner.first} signs, or nobody leaves. The phone never goes dead, and the bolt never moves.', reveal: ['lets_go'], moves: { taker: 'heard' }, objective: 8 },
                '{courier.first} dozes against the parcel boxes until dawn.', '{owner.first} is slumped against the till by dawn.', [KEEPS]),
            ],
            mixed: [
              { if: [LETS_GO, OWNER_OK], text: 'Before midnight, {owner.first} is allowed out. The handgun and the receiver stay with {taker.first}.', reveal: ['owner_faint'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 35, minutes: 20 },
              { if: [LETS_GO, OWNER_OUT], text: 'By midnight {owner.first} can’t sit up. {taker.first} lets the team in for {owner.him} but won’t give up the handgun.', reveal: ['owner_faint'], safe: ['owner'], harm: { owner: 'serious' }, next: { ending: 'owner_collapsed' }, objective: 14, minutes: 20 },
              courierToo('{courier.first} gets released first.', { if: LETS_GO }),
              ...heldEnd({ if: KEEPS, text: 'Every hour {taker.first} makes the same offer down the line, the signature first and then the door. By dawn the offer hasn’t moved an inch.', reveal: ['lets_go'], moves: { taker: 'provoked' }, objective: 4 },
                '{courier.first} sleeps sitting up, the parcel in {courier.his} lap.', '{owner.first} is down behind the counter before dawn.', [KEEPS]),
            ],
            adverse: [
              { text: 'The line goes silent and stays that way.', pressure: 10 },
              { if: [RAISED, OWNER_OK], text: 'From the corner window, officers see {taker.first} take the handgun to {owner.first}.', reveal: ['raised'], next: { node: 'threat' } },
              { if: [CALM, BREAKING, OWNER_OK], text: 'The receiver hits the floor, and the handgun is aimed at {owner.first}.', mark: ['turned'], next: { node: 'threat' } },
              // A clock that has run out stays out, so OWNER_OK also means the owner is still on the stool.
              { if: [CALM, HOLDING, OWNER_OK], when: { safe: ['courier'] }, text: 'Command keeps the block shut through the night.', reveal: ['raised'], next: { ending: 'held_inside' } },
              { if: [CALM, HOLDING, OWNER_OK], when: { notSafe: ['courier'] }, text: '{courier.first} spends the night on those boxes too.', reveal: ['raised'], next: { ending: 'held_both' } },
              { if: OWNER_OUT, text: 'In the night, {owner.first} collapses out of sight. Nobody inside answers the team.', next: { node: 'owner_down' } },
            ],
          } },
        { id: 'read_back', title: 'Read {taker.his} account back', icon: 'handover', talksTo: 'taker', check: check(TALK, -2), minutes: 8, onlyIf: { marks: ['account'] },
          summary: '{lead} reads back every line of the account on the pad, slowly, so {taker.first} can hear {taker.his} own words in someone else’s voice. {owner.first} hears it too, with {taker.first} standing over {owner.him}.',
          pull: 'Being taken seriously, at last, by people who wrote it all down.',
          cost: 'One wrong word read back can start it all again.',
          preview: { favorable: '{taker.first} hears {taker.his} own words, and the signature may stop mattering.', mixed: '{taker.first} corrects the account line by line while {owner.first} waits.', adverse: '{taker.first} hears a line {taker.he} never said and may turn on {owner.first} for it.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: 'The whole account gets read without a word from {taker.first}. When the last line is read, the phone goes silent for a long time. Then {taker.he} {taker~says|say} that will do, that is what happened, and {owner.first} leaves unsigned.', reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} leads the way out.', { if: LETS_GO }),
              ...heldEnd({ if: KEEPS, text: '{taker.first} doesn’t interrupt once. At the end {taker.he} {taker~says|say} every line of it is true, and that is why {owner.first} has to put {owner.his} name under it. The pen is still on the pad.', reveal: ['lets_go'], moves: { taker: 'heard' }, objective: 10 },
                '{courier.first} has stopped checking {courier.his} phone.', '{owner.first} has gone gray at the counter.', [KEEPS]),
            ],
            mixed: [
              { if: LETS_GO, text: 'The reading stops four times while {taker.first} fixes a word. When it is right, {owner.first} can go, but the handgun stays.', reveal: ['lets_go'], safe: ['owner'], mark: ['still_armed'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 38, minutes: 6 },
              courierToo('{courier.first} gets the door first.', { if: LETS_GO }),
              ...heldEnd({ if: KEEPS, text: '{taker.first} fixes four words and says the account is right now, so {owner.first} can sign it. Nobody moves toward the door.', reveal: ['lets_go'], moves: { taker: 'provoked' }, objective: 6, minutes: 6 },
                '{courier.first} stays put by the parcels.', '{owner.first} sags against the register and doesn’t straighten.', [KEEPS]),
            ],
            adverse: [
              { text: '“That’s not what I said,” {taker.first} shouts.', moves: { taker: 'provoked' }, pressure: 12 },
              { if: RAISED, text: 'Officers at the window watch {taker.him} wheel on {owner.first}, handgun out.', reveal: ['raised'], next: { node: 'threat' } },
              { if: [CALM, BREAKING], text: '{taker.He} {taker~has|have} had enough of being misheard and {taker~points|point} at {owner.first}.', mark: ['turned'], next: { node: 'threat' } },
              ...heldEnd({ if: [CALM, HOLDING], text: '{taker.He} {taker~hangs|hang} up before the next line.', reveal: ['raised'] },
                '{courier.first} is still waiting on the boxes.', '{owner.first} has slid off the stool and isn’t getting up.', [CALM, HOLDING]),
            ],
          } },
        // E4.4: when the taker has withdrawn, the call stays with the person (review F10).
        { id: 'stay_on', title: 'Stay on with {taker.him}', icon: 'radio', talksTo: 'taker', check: check(HOLD, -8), minutes: 15, onlyIf: { marks: ['withdrawn'] },
          summary: '{lead} asks {taker.first} who {taker.he} still {taker~sees|see} on Sundays, and keeps asking, about the cousin, the dinners, anything that has a tomorrow in it. {owner.first} waits inside the whole time.',
          pull: 'Stay with the person, not the standoff.',
          cost: '{owner.first} waits inside while you talk about Sundays.',
          preview: { favorable: '{taker.first} talks about the people still in {taker.his} life, and decides about {owner.first}.', mixed: 'You get one-word answers, and {owner.first} never leaves the stool.', adverse: '{taker.first} goes silent on you, with {owner.first} an arm’s length away.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{taker.first} talks about Sunday dinners, a cousin, a dog that died. Then {taker.he} {taker~asks|ask} whether the medic out front is for {taker.him} too, and lets {owner.first} go.',
                exchange: [{ by: 'negotiator', line: 'The medic’s there for anybody who needs one.' }], reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} walks out a few steps behind {owner.first}.', { if: LETS_GO }),
              ...heldEnd({ if: KEEPS, text: 'The Sunday stories run out before {taker.first} does. {taker.first} doesn’t hang up, and {owner.first} hasn’t left the till.', reveal: ['lets_go'], moves: { taker: 'heard' }, objective: 10 },
                '{courier.first} sits it out by the door.', '{owner.first} has slipped down behind the counter.', [KEEPS]),
            ],
            mixed: heldEnd({ text: '{taker.first} answers in single words, but {taker.he} {taker~keeps|keep} the line open.', moves: { taker: 'heard' }, objective: 6 },
              'Through all of it, {courier.first} sits near the door.', '{owner.first} goes down behind the register within the hour.'),
            adverse: heldEnd({ text: '{taker.first} stops answering halfway through a sentence.', pressure: 6 },
              '{courier.first} is still in there too.', 'Then {owner.first} slumps against the till and doesn’t sit back up.'),
          } },
        // Family on the line, as a gamble (owner 2026-10-19).
        { id: 'cousin_line', title: 'Put {cousin.first} on the line', icon: 'radio', talksTo: 'taker', check: check(TALK, -4), minutes: 8, onlyIf: { notMarks: ['cousin_gone'] },
          summary: '{cousin.first} came straight from the bus depot and has been at the tape for an hour, asking to talk to {taker.first}. Family can reach a person no negotiator can. Family can also say the one thing that has gone unsaid for years, where every regular can hear it, and nobody can take it back.',
          pull: 'The one voice {taker.first} has known all {taker.his} life.',
          cost: 'You can’t control what {cousin.first} says, and {taker.first} hears every word.',
          preview: { favorable: '{cousin.first} says the right thing, and {taker.first} decides about {owner.first}.', mixed: '{cousin.first} can’t get through it, and the call goes quiet without ending.', adverse: '{cousin.first} says the unsayable on an open line, with {owner.first} three feet from the handgun.' },
          outcomes: {
            favorable: [
              { if: LETS_GO, text: '{cousin.first} doesn’t plead. {cousin.He} {cousin~talks|talk} about the night route and Sunday dinners and the last time they argued, over nothing. {taker.first} cuts in halfway through to tell {owner.first} to leave, and {owner.first} leaves.',
                exchange: [{ by: 'cousin', line: 'Come out and eat something. I brought the car.' }], reveal: ['lets_go'], safe: ['owner'], moves: { taker: 'heard' }, next: { node: 'last_one' }, objective: 45 },
              courierToo('{courier.first} walks out beside {owner.first}.', { if: LETS_GO }),
              ...heldEnd({ if: KEEPS, text: '{cousin.first} talks {taker.first} into setting the handgun on the counter, but not into letting {owner.first} go. That still takes a name on a page, {taker.first} says, gently now.', exchange: [{ by: 'cousin', line: 'Then I’ll wait out here as long as it takes.' }], reveal: ['lets_go'], moves: { taker: 'heard' }, objective: 12 },
                '{courier.first} keeps still by the door.', '{owner.first} sags off the stool while they talk and doesn’t get up.', [KEEPS]),
            ],
            mixed: heldEnd({ text: '{cousin.first} gets three sentences in and has to hand the phone back to an officer. {taker.first} stays on the line, listening to {cousin.him} cry, and says nothing for a long time.', moves: { taker: 'heard' }, objective: 6 },
              '{courier.first} has {courier.his} eyes shut, on the boxes.', '{owner.first} slips off the stool partway through and stays on the tiles.'),
            adverse: [
              { text: '{cousin.first} says what the family always said, that {taker.first} would end up exactly like this. The whole tape hears it.', moves: { taker: 'provoked' }, pressure: 12 },
              { if: RAISED, text: 'Then the handgun swings toward {owner.first}, the nearest person who heard it.', reveal: ['raised'], next: { node: 'threat' } },
              { if: [CALM, BREAKING], text: '{taker.first} can’t take one more voice telling {taker.him} who {taker.he} {taker~is|are}, and aims at {owner.first}.', mark: ['turned'], next: { node: 'threat' } },
              ...heldEnd({ if: [CALM, HOLDING], text: '{taker.first} hangs up and goes quiet, in a way that frightens the team more than shouting would.', reveal: ['raised'], mark: ['withdrawn'] },
                '{courier.first} is still in there with {taker.him}.', 'Then {owner.first} goes down behind the counter, and nobody inside moves.', [CALM, HOLDING]),
            ],
          } },
        { id: 'pull_back', title: 'Pull back to the corner', icon: 'handover', check: check(MOVE, -20), minutes: 2, onlyIf: { notMarks: ['withdrawn'] },
          summary: 'Your squad withdraws a block and holds the street. Nobody pushes {taker.first} tonight, and nobody gets {owner.first} out either. {owner.first} is left inside with {taker.first} and whatever comes after.',
          pull: 'Nobody forces anything, and nobody walks into a doorway.',
          cost: '{owner.first} is left inside, and the call isn’t yours anymore.',
          preview: { favorable: 'You hold the corner. {owner.first} stays inside, and if {owner.he} {owner~is|are} unwell, nobody can reach {owner.him}.', mixed: 'From the corner, you keep the block shut. {owner.first} stays with {taker.first}.', adverse: 'You give up the glass and nobody gets {owner.first} out.' },
          outcomes: {
            favorable: heldEnd({ text: 'The team withdraws to the corner. {owner.first} remains at the till.', objective: 5 },
              '{courier.first} is in there too, on the boxes.', 'Then {owner.first} folds over behind the till, out of anyone’s reach.'),
            mixed: heldEnd({ text: 'Officers fall back and close the block. Inside, {taker.first} hasn’t let {owner.first} go.', objective: 5 },
              '{courier.first} is in there too, by the entrance.', '{owner.first} tips sideways from the stool onto the tiles.'),
            adverse: heldEnd({ text: 'The team gives up the windows and holds the cross street.', objective: 5 },
              '{courier.first} is stuck inside with {taker.first}.', 'Behind the till, {owner.first} lies where {owner.he} fell.'),
          } },
      ] },
    { id: 'threat', stage: 'resolve',
      threat: { label: 'More sirens', minutes: 3, text: 'More sirens arrive from three blocks over, and {taker.first} turns to watch the lights wash across the glass.', pressure: 6 },
      prompt: '{owner.first} has gone still since {taker.first} raised the handgun toward {owner.him}. {owner.His} hands are on the counter, {owner.his} eyes on {taker.first}’s face, not the handgun.',
      exchange: [{ by: 'radio', line: 'Side window. Handgun’s pointed at the owner. Holding.' }, { by: 'owner', line: '{taker.first}. Look at me.' }],
      promptIf: [
        { when: { marks: ['withdrawn'] }, prompt: '{taker.first} wants nothing from anyone now, and {owner.first} is the one the handgun points at.',
          exchange: [{ by: 'negotiator', line: 'Are you planning to hurt yourself?' }, { by: 'taker', line: 'Just keep everybody back.' }] },
        { when: { notSafe: ['courier'] }, prompt: 'The handgun is pointed at {owner.first}. {courier.first} is pressed against the stacked boxes.' },
        { when: GROUP_IN, prompt: '{owner.first} is pinned against the counter by {taker.first}. {others} {others#has|have} backed against the shelves.' },
        { when: { marks: ['team_close'] }, prompt: '{owner.first} is staring at what {taker.first} is holding. Your squad is a few steps away.' },
      ],
      choices: [
        { id: 'talk_down', title: 'Talk {taker.him} down', icon: 'radio', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'taker' } }, talksTo: 'taker', check: check(TALK, 6), minutes: 3, stress: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, modifiers: [{ label: 'You know how that day went', mark: 'knows_story', value: 6 }],
          summary: '{lead} steps up to the glass, in plain view and in line with the handgun, and calls {taker.first} by name. No more phone. A person, a face and a voice that hasn’t changed all day. If the handgun turns, it turns toward {lead}.',
          pull: 'Someone {taker.first} already knows, at the worst moment.',
          cost: '{lead} stands in line with the handgun.',
          preview: { favorable: 'The handgun is set down, and {owner.first} walks out ahead of {taker.first}.', mixed: '{owner.first} gets out, and {taker.first} stays armed.', adverse: 'Whoever stands at the glass may be hit if {taker.first} fires.' },
          outcomes: {
            favorable: [
              { text: '{taker.first} looks at the glass for a long moment, then at {owner.first}. {taker.He} {taker~sets|set} the handgun next to the register, carefully, the way a person puts down something that belongs to someone else, and {taker~lets|let} {owner.first} out first. {taker.He} {taker~follows|follow} on the team’s word into the hands of two officers by the step.', safe: ['owner'], moves: { taker: 'released' }, ...surrender('everyone_out'), objective: 75, pressure: -12 },
              courierToo('{courier.first} is already on the sidewalk.'),
              { when: { lead: ['band_veteran'] }, text: 'The squad’s veteran has stood at glass like this before and keeps the same even voice the whole way through.' },
            ],
            mixed: [
              { text: '{owner.first} gets out the front door. {taker.first} backs away from the window, the handgun still up.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} is out before {owner.him}.'),
            ],
            adverse: [{ text: 'A shot goes through the window as {taker.first} spins around. {owner.first} is still inside.', fire: { from: 'taker' }, mark: ['shot_at_team'], moves: { taker: 'shots', others: 'shots' }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        { id: 'go_in', title: 'Send the team in', icon: 'shield', team: { to: 'scene', entry: 'taker' }, check: check(ENTER, 8), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'Your squad is already close', mark: 'team_close', value: 8 }, { label: 'Spare key in hand', mark: 'spare_key', value: 8 }, { label: 'Front door unbolted', mark: 'door_open', value: 6 }],
          summary: 'Your squad goes through the front while {lead} keeps {taker.first} busy at the window. It is the fastest way to {owner.first}, and the one where anyone in that room can be badly hurt or die, {owner.first} first. Command approves it, and it goes to review whatever happens.',
          pull: 'Reach {owner.first} while {owner.he} {owner~is|are} still on {owner.his} feet.',
          cost: '{owner.first} could die in the doorway, and so could {taker.first}.',
          preview: { favorable: 'You reach {owner.first} and get {owner.him} out.', mixed: '{owner.first} is out, hurt on the way.', adverse: '{taker.first} turns on {owner.first} as you come in. Either of them can be badly hurt, and {owner.first} could die.' },
          outcomes: {
            favorable: [
              { text: 'The team is through the door before {taker.first} turns. {owner.first} is out on the sidewalk, and the team has {taker.first}, the handgun out of reach.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'entry_clean' }, objective: 50 },
              courierToo('{courier.first} goes out ahead of {owner.him}.'),
              { when: GROUP, text: '{others} {others#lies|lie} down without being told.' },
            ],
            mixed: [
              { text: '{owner.first} falls hard against the counter as the team pulls {owner.him} clear. The medic at the curb checks {owner.his} arm, and {taker.first} is taken.', safe: ['owner'], harm: { owner: 'wounded' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 35 },
              courierToo('{courier.first} is out first.'),
            ],
            adverse: [
              { if: LETS_GO, text: '{taker.first} hauls {owner.first} low behind the register as the door gives. {owner.first} hits the floor hard, and {taker.first} lets go when the team reaches them.', reveal: ['lets_go'], safe: ['owner'], harm: { owner: 'serious' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
              { if: KEEPS, text: '{taker.first} fires at {owner.first} when the door swings in, then turns toward the team.', reveal: ['lets_go'], harm: { owner: 'fatal' }, out: ['others'], force: { on: 'taker', next: { hurt: { ending: 'owner_killed_taker_hurt' }, none: { ending: 'owner_killed' } }, noFatal: true }, objective: 5 },
              { if: KEEPS, text: '', fire: { from: 'taker' } },
              courierToo('{courier.first} slips away in the struggle.'),
            ],
          } },
        { id: 'step_back', title: 'Clear out of sight', icon: 'wait', check: check(HOLD, -2), minutes: 8,
          summary: 'Every officer steps back out of {taker.first}’s sight, off the glass and off the street, until there is nobody left for {taker.him} to aim at and nobody to perform for. That also leaves nobody near enough to help {owner.first} if it goes wrong.',
          pull: 'Take away the audience and the target in one move.',
          cost: 'Nobody is close enough to reach {owner.first} if it goes wrong.',
          preview: { favorable: 'With nobody in view, the handgun comes down.', mixed: '{taker.first} puts the handgun down but won’t release {owner.first}.', adverse: 'The handgun stays where it is, and nobody is close by if {taker.first} hurts {owner.first}.' },
          outcomes: {
            favorable: [
              { text: 'With the street suddenly empty, {taker.first} lowers the handgun by inches. After a minute {taker.he} {taker~picks|pick} up the phone, {taker~asks|ask} where everybody went, and {taker~tells|tell} {owner.first} to go while nobody is looking.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 40 },
              courierToo('{courier.first} leaves the place with {owner.him}.'),
            ],
            mixed: heldEnd({ text: 'The handgun drops to {taker.first}’s side, but {owner.first} isn’t let go. The block stays sealed.', objective: 15 },
              '{courier.first} stays put on the boxes.', '{owner.first} slumps to the tiles, and nobody inside helps {owner.him} up.'),
            adverse: [
              ...heldEnd({ if: LETS_GO, text: 'From the corner, the team can see {owner.first} still in the handgun’s path.', reveal: ['lets_go'], pressure: 8 },
                '{courier.first} has {courier.his} back to the wall by the door.', 'Then {owner.first} goes down, and {taker.first} stands over {owner.him}.', [LETS_GO]),
              { if: KEEPS, text: 'By the time the team looks again, {owner.first} has signed, struck with the handgun until {owner.he} did. {taker.first} sends {owner.him} out the front, holding {owner.his} face, and keeps the page folded in {taker.his} shirt pocket like a receipt.', reveal: ['lets_go'], safe: ['owner'], harm: { owner: 'serious' }, next: { ending: 'owner_beaten' }, objective: 10, pressure: 10 },
              courierToo('{courier.first} is waved out after {owner.him}.', { if: KEEPS }),
            ],
          } },
      ] },
    { id: 'fired_on', stage: 'resolve',
      threat: { label: 'The neighbors lean out', minutes: 5, text: 'Upstairs windows along the block are open now, with people leaning out to see. Patrol shouts at them to get back inside.', pressure: 6, civilian: -2 },
      prompt: 'A shot has been fired, and every officer on the street heard where it came from. {owner.first} is still at the counter. Nobody inside has said a word since, and the radio has gone quiet too.',
      exchange: [{ by: 'radio', line: 'One round fired. Everybody’s back behind cover.' }],
      promptIf: [
        { when: { marks: ['shot_inside'] }, prompt: 'There is plaster dust on the counter and a hole in the ceiling above the register. {courier.first} is frozen in the doorway, half in and half out, and {owner.first} is back behind the counter where {taker.first} pulled {owner.him}.' },
        { when: { notSafe: ['courier'] }, prompt: 'Since the shot, neither {owner.first} nor {courier.first} has come out.' },
      ],
      choices: [
        { id: 'go_in', title: 'Go in now', icon: 'shield', team: { to: 'scene', entry: 'taker' }, check: check(ENTER, 12), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'Officers are already at the door', mark: 'team_close', value: 8 }, { label: 'The landlord’s key works', mark: 'spare_key', value: 8 }, { label: 'The bolt is open', mark: 'door_open', value: 6 }],
          summary: 'Your squad goes in at someone who has just fired, with the shot still ringing in everyone’s ears. {owner.first} is in there with that handgun for every second you wait. In the doorway {owner.first} could die, so could {taker.first}, and an officer could be hit.',
          pull: 'Someone just fired, and {owner.first} is in the room with it.',
          cost: 'An officer can be hit, and so can the people inside.',
          preview: { favorable: 'You get to {owner.first} first and bring {owner.him} out.', mixed: 'You bring {owner.first} out with an injury.', adverse: '{taker.first} meets you at the till, armed. {owner.first} may not survive the entry, and {taker.first} may be hurt too.' },
          outcomes: {
            favorable: [
              { text: 'Officers get there before {taker.first} can swing around. {owner.first} is out on the street before {owner.he} {owner~knows|know} {owner.he} {owner~has|have} moved, and {taker.first} ends up face down on the tiles with empty hands, saying sorry to nobody in particular.', safe: ['owner'], out: ['taker', 'others'], next: { ending: 'entry_clean' }, objective: 50 },
              courierToo('{courier.first} is already outside.'),
              { when: GROUP, text: '{others} {others#shows|show} officers {others.his} empty hands.' },
            ],
            mixed: [
              { text: '{owner.first} goes down against the shelves in the rush and comes out holding {owner.his} arm. Officers hold {taker.first}.', safe: ['owner'], harm: { owner: 'wounded' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 35 },
              courierToo('{courier.first} beats everyone outside.'),
            ],
            adverse: [
              { if: LETS_GO, text: '{taker.first} drags {owner.first} to the floor as officers come in. {owner.first} is badly hurt when they pull {owner.him} free, and {taker.first} surrenders.', reveal: ['lets_go'], safe: ['owner'], harm: { owner: 'serious' }, out: ['taker', 'others'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
              { if: KEEPS, text: '{taker.first} fires again, this time at {owner.first}, then swings toward the door.', reveal: ['lets_go'], harm: { owner: 'fatal' }, out: ['others'], force: { on: 'taker', next: { hurt: { ending: 'owner_killed_taker_hurt' }, none: { ending: 'owner_killed' } }, noFatal: true }, objective: 5 },
              { if: KEEPS, text: '', fire: { from: 'taker' } },
              courierToo('{courier.first} crawls out the door in the noise.'),
            ],
          } },
        { id: 'hold_corner', title: 'Regroup and call {taker.him}', icon: 'wait', talksTo: 'taker', check: check(HOLD), minutes: 10,
          summary: 'You pull everyone back behind cover, count heads, and call {place} again. {owner.first} stays inside with someone who has just fired, while you find out why.',
          pull: 'Learn what that shot meant before anyone answers it.',
          cost: '{owner.first} stays in a room where a shot was just fired.',
          preview: { favorable: 'You get an answer, and {owner.first} goes free.', mixed: '{taker.first} talks but keeps {owner.first} there.', adverse: 'No answer comes, and {owner.first} stays in there with {taker.him}.' },
          outcomes: {
            favorable: [
              { text: 'On the fourth call {taker.first} picks up. {taker.His} voice is shaking. {taker.He} {taker~keeps|keep} saying {taker.he} didn’t mean to fire, that it just went off, and that {owner.first} can go right now.', safe: ['owner'], mark: ['still_armed'], moves: { taker: 'released' }, next: { node: 'last_one' }, objective: 35 },
              courierToo('{courier.first} comes out alongside {owner.him}.'),
            ],
            mixed: heldEnd({ text: '{taker.first} picks up but won’t let {owner.first} go. The street stays shut.', objective: 8 },
              '{courier.first} is crouched by the boxes.', 'The shot never touched {owner.first}, but {owner.he} {owner~has|have} sunk down by the till, and nobody has reached {owner.him}.'),
            adverse: heldEnd({ text: 'The phone rings out every time, and the street stays sealed off.', pressure: 6 },
              'Nobody has let {courier.first} out.', '{owner.first} is down on the floor now, untouched by the shot.'),
          } },
      ] },
    { id: 'owner_down', stage: 'resolve',
      threat: { label: '{taker.first} panics', minutes: 4, text: '{taker.first} is shouting down the phone for an ambulance, and every answer from outside makes {taker.him} louder.', pressure: 8 },
      prompt: '{owner.first} has collapsed behind the counter and isn’t answering, and {taker.first} is shouting into the phone for somebody to do something. A medic waits at the corner with the bag open. The door is still bolted, and only {taker.first} can unbolt it.',
      exchange: [{ by: 'radio', line: 'Medic says minutes, not an hour.' }],
      // A clock that runs out in the decision a shot came from (onOut.next) arrives here after that
      // shot's line, so the prompt says the shot missed the owner.
      promptIf: [{ when: { marks: ['shot_at_team'] }, prompt: 'The shot missed {owner.first}. Now {owner.he} {owner~is|are} slumped on the floor, and a medic stands by out front.' }],
      choices: [
        { id: 'medic_door', title: 'Get the medic to {owner.first}', icon: 'radio', talksTo: 'taker', check: check(TALK, -4), minutes: 3,
          summary: '{lead} asks {taker.first} to unbolt the front for the medic, now, and to step back from the door while two officers carry {owner.first} out. It asks {taker.him} to trust you with the one thing that matters to everyone right now.',
          pull: 'The fastest care {owner.first} can get, with nobody hurt.',
          cost: 'It only works if {taker.first} opens that door.',
          preview: { favorable: 'The bolt comes back, and {owner.first} is carried out.', mixed: '{owner.first} is brought out while {taker.first} watches, armed.', adverse: '{taker.first} won’t open, and {owner.first} lies there untreated.' },
          outcomes: {
            favorable: [
              { text: '{taker.first} slides the bolt and steps back from the door with {taker.his} palms out, the handgun on the counter behind {taker.him}. Two officers lift {owner.first} onto a stretcher. As they go, {taker.first} asks them to take {owner.his} coat.', safe: ['owner'], moves: { taker: 'released' }, next: { ending: 'owner_collapsed' }, objective: 25 },
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
        { id: 'go_in', title: 'Go in for {owner.first}', icon: 'shield', team: { to: 'scene', entry: 'taker' }, check: check(ENTER, 4), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
          requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
          modifiers: [{ label: 'A key to the front', mark: 'spare_key', value: 8 }, { label: 'The front is unbolted', mark: 'door_open', value: 6 }],
          summary: '{lead} takes your squad in for {owner.first} without waiting for the bolt. Minutes matter for a heart, and the door is the only thing in the way. {taker.first} is armed and frightened, and anyone at that counter can be hurt.',
          pull: 'A failing heart can’t wait for a bolt.',
          cost: 'Going through an armed, frightened person to reach {owner.him}.',
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
      threat: { label: '{taker.first} sits down', minutes: 5, text: '{taker.first} sits on the floor behind the counter, out of sight of the glass, and lets the phone ring.', pressure: 4 },
      prompt: '{courier.first} and {owner.first} are outside with patrol, each in a gray blanket from the medic. {taker.first} is alone behind the counter of a place {taker.he} opened every day for six years, and the only thing left to decide is how {taker.he} {taker~walks|walk} out.',
      exchange: [{ by: 'taker', line: 'Everybody out there is filming.' }, { by: 'negotiator', line: 'Tell me what you need to walk out.' }],
      promptIf: [
        { when: GROUP_IN, prompt: '{owner.first} and {courier.first} are clear. {others} {others#is|are} still beside {taker.first}.' },
        { when: { marks: ['still_armed'] }, prompt: 'Both people {taker.first} held are clear, and {taker.he} {taker~has|have} the handgun by the register.' },
      ],
      choices: [
        { id: 'out_front', title: 'Talk {taker.him} out the front', icon: 'radio', talksTo: 'taker', check: check(TALK, 4), minutes: 6, onlyIf: { notMarks: ['back_promised'] },
          modifiers: [{ label: '{taker.He} still {taker~has|have} the handgun', mark: 'still_armed', value: -8 }, { label: 'You heard the whole story', mark: 'knows_story', value: 4 }],
          summary: '{lead} tells {taker.first} exactly how to come out, one step at a time, hands open, through the front door and past the street and every phone at the tape. It is the plainest way out, and the most public. The regulars are out there.',
          pull: 'Simple instructions, in plain view.',
          cost: 'The whole street watches {taker.first} walk out.',
          preview: { favorable: '{taker.first} walks out the front with empty hands.', mixed: '{taker.first} stalls in the doorway with the street watching, then comes out.', adverse: '{taker.first} won’t walk out where the street can see, and stays at the counter.' },
          outcomes: {
            favorable: [{ text: '{taker.first} steps through the front door with {taker.his} hands open, the way the team tells {taker.him}, and stops at the top step to look at the regulars behind the tape. One of them lifts a hand. Officers take {taker.him} by the arms.', ...surrender('everyone_out'), objective: 30 }],
            mixed: [{ text: '{taker.first} stands inside the glass for twenty minutes, then steps out past a row of phones at the tape. Two officers meet {taker.him} on the step.', ...surrender('everyone_out'), objective: 25, minutes: 15 }],
            adverse: [{ text: '{taker.first} isn’t walking out in front of everyone, {taker.he} {taker~says|say}, and sits back down at the register.', next: { ending: 'taker_held' }, objective: 5 }],
          } },
        { id: 'out_back', title: 'Bring {taker.him} out the back', icon: 'door', team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'taker' } }, talksTo: 'taker', check: check(TALK, -4), minutes: 5, onlyIf: { marks: ['wants_back'] }, authority: { concede: 'surrender_terms' },
          modifiers: [{ label: 'The handgun is still in reach', mark: 'still_armed', value: -8 }],
          summary: '{lead} brings {taker.first} out the rear, as promised, away from the tape and every camera on the street. It keeps {taker.his} face out of tomorrow’s phones. The alley is narrow and dark, though, and leaves little room for a change of mind.',
          pull: 'Keep the promise, and keep {taker.his} face off the street.',
          cost: 'A narrow dark alley, and no room if {taker.he} {taker~changes|change} {taker.his} mind.',
          preview: { favorable: '{taker.first} steps into the alley with nothing in {taker.his} hands.', mixed: '{taker.first} hesitates at the rear, then comes out.', adverse: '{taker.first} stops in the back doorway and goes back inside.' },
          outcomes: {
            favorable: [{ text: '{taker.first} comes out the alley door with open hands and asks the team not to let the street see {taker.him}. The team has {taker.him} before the corner.', ...surrender('out_the_back'), objective: 32 }],
            mixed: [{ text: '{taker.first} gives up in the alley, hands empty, but a neighbor at the far end has a phone up.', ...surrender('out_the_back'), objective: 26 }],
            adverse: [{ text: 'At the doorway {taker.first} backs inside again and bolts the rear exit.', next: { ending: 'taker_held' } }],
          } },
        // A regular at the tape calls out, as a gamble: the crowd can turn a walk-out into a show.
        { id: 'regular_call', title: 'Let {regular.first} shout to {taker.him}', icon: 'radio', check: check(TALK, 2), minutes: 6, onlyIf: { notMarks: ['back_promised'] },
          summary: '{regular.first} is pushing toward the front of the crowd and wants to shout to {taker.first} from the street. It might be the voice that makes walking out bearable. It might also turn the walk-out into a show for everyone holding up a phone.',
          pull: 'A friendly face waiting at the end.',
          cost: 'The street turns into an audience, and audiences change people.',
          preview: { favorable: '{taker.first} walks out toward a voice {taker.he} {taker~knows|know}.', mixed: '{taker.first} comes out, but the street makes a scene of it.', adverse: '{taker.first} hears the crowd, not the friend, and stays behind the counter.' },
          outcomes: {
            favorable: [{ text: '{regular.first} calls out the usual order, the way {regular.he} {regular~has|have} every morning for nine years. Inside, {taker.first} laughs once. Then {taker.he} {taker~walks|walk} out with {taker.his} hands open, straight toward the one face {taker.he} {taker~knows|know}, and officers meet {taker.him} halfway.', ...surrender('everyone_out'), objective: 30 }],
            mixed: [{ text: '{taker.first} comes out to {regular.first}’s voice, and the crowd at the tape erupts, cheering and filming both. {taker.first} keeps {taker.his} head down all the way to the officers.', ...surrender('everyone_out'), objective: 25 }],
            adverse: [{ text: '{regular.first} calls out, and half the crowd joins in, chanting {taker.first}’s name like a game. {taker.first} looks at the phones held up behind {regular.him} and goes back behind the counter.', next: { ending: 'taker_held' }, objective: 4 }],
          } },
        { id: 'let_him_sit', title: 'Let {taker.him} decide', icon: 'wait', check: check(HOLD, -8), minutes: 45, span: 'All night',
          summary: 'Command keeps the street closed while {taker.first} decides, alone, when to come out. Nobody is in danger in there now but {taker.first}. Your squad stays on the corner until morning if it takes until morning.',
          pull: 'No one left to protect but {taker.first}, so let time do it.',
          cost: 'Your squad holds a corner all night, and {taker.first} sits alone with it.',
          preview: { favorable: '{taker.first} calls out that {taker.he} {taker~is|are} coming out.', mixed: 'The door opens near dawn.', adverse: 'The shift ends and {taker.first} hasn’t come out.' },
          outcomes: {
            favorable: [{ text: '{taker.first} shouts through the door that {taker.he} {taker~is|are} done. {taker.He} {taker~walks|walk} to the team with {taker.his} palms showing.', ...surrender('out_by_dawn'), objective: 28 }],
            mixed: [{ text: 'As the sky gets light, {taker.first} unlocks the front and gives {taker.himself} up.', ...surrender('out_by_dawn'), objective: 24, minutes: 30 }],
            adverse: [{ text: 'When the shift changes, {taker.first} hasn’t moved from the counter.', next: { ending: 'taker_held' } }],
          } },
      ] },
    // Only after a surrender that split the group (the cascade's `some`): part of the group came out.
    { id: 'stayed_behind', stage: 'resolve',
      threat: { label: 'An argument inside', minutes: 5, text: 'Through the glass the team can see the ones who stayed arguing by the register, one of them waving at the door.', pressure: 4 },
      prompt: '{taker.first} and part of {taker.his} old shift have come out. Whoever stayed is behind the till, in a place that suddenly has nobody left to follow, and nobody inside has turned the lights off yet.',
      choices: [
        { id: 'call_rest', title: 'Call the others out', icon: 'radio', talksTo: 'others', check: check(TALK, -4), minutes: 5,
          summary: '{lead} calls each name left inside, one at a time, in the same voice {taker.first} heard all day. Whoever stayed has just watched {taker.first} walk out without them, and may be waiting for exactly this.',
          pull: 'Names, said plainly, while the moment is still fresh.',
          cost: 'A voice from outside may push them further back.',
          preview: { favorable: 'One by one, the stragglers come to the door.', mixed: 'They come out, after one of them argues at the door.', adverse: 'Nobody else comes, and the place goes dark.' },
          outcomes: {
            favorable: [{ text: 'The ones still inside come out with open palms, single file, and the team takes them.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 20 }],
            mixed: [{ text: 'One of them shouts that they only came here to vouch for a friend. Then the last of them walk out.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 16 }],
            adverse: [{ text: 'Someone inside switches off the lights. Nobody else comes to the door.', next: { ending: 'stayers_held' } }],
          } },
        { id: 'wait_rest', title: 'Wait for the rest', icon: 'wait', check: check(HOLD, -10), minutes: 30, span: 'Hours',
          summary: 'Your squad holds the corner and lets whoever stayed come out when they are ready, on their own feet and their own time. Nobody in there is a danger to anyone but themselves now. That could take all night.',
          pull: 'Nobody pushed, nobody cornered.',
          cost: 'Your squad holds a cold corner until they choose.',
          preview: { favorable: 'Before morning, the rest walk out.', mixed: 'The rest appear at first light.', adverse: 'Morning comes with someone still inside.' },
          outcomes: {
            favorable: [{ text: 'A few hours on, the ones who stayed walk out with empty hands, one at a time, each stopping to look for {taker.first} at the patrol cars.', out: ['others'], next: { ending: 'group_out' }, objective: 16 }],
            mixed: [{ text: 'At first light the front door opens, and the last of the shift come out squinting.', out: ['others'], next: { ending: 'group_out_dawn' }, objective: 12, minutes: 20 }],
            adverse: [{ text: 'By morning the place is still dark, with someone in it.', next: { ending: 'stayers_held' } }],
          } },
      ] },
    // Only after a surrender nobody followed (the cascade's `none`).
    { id: 'nobody_followed', stage: 'resolve',
      threat: { label: 'A table across the door', minutes: 5, text: 'The ones still inside drag a table across the front door and sit on it.', pressure: 4 },
      prompt: '{taker.first} walked out alone and didn’t look back at the place. {others} {others#is|are} still in there, and nobody is talking, not to you and not to each other.',
      choices: [
        { id: 'call_others', title: 'Call them out by name', icon: 'radio', talksTo: 'others', check: check(TALK, -2), minutes: 5,
          summary: '{lead} names {others} and says {taker.first} is out and unhurt, sitting with officers, asking about them. It is the one fact that might move {others.him}. A voice from the street may not be enough.',
          pull: 'The one thing they need to hear, that {taker.first} is all right.',
          cost: 'If it doesn’t move them, nothing said from the street will.',
          preview: { favorable: '{others} {others#appears|appear} at the door.', mixed: 'After asking twice about {taker.first}, {others} {others#steps|step} out.', adverse: '{others} {others#remains|remain} out of sight, and the lights go off.' },
          outcomes: {
            favorable: [{ text: '{others} {others#walks|walk} out together, palms showing, and officers take {others.him} aside.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 20 }],
            mixed: [{ text: '{others.first} asks whether {taker.first} is hurt before anyone moves. Then {others.he} {others~heads|head} for the door.', out: ['others'], moves: { others: 'heard' }, next: { ending: 'group_out' }, objective: 16 }],
            adverse: [{ text: 'The place lights go off. {others} {others#doesn’t|don’t} answer.', next: { ending: 'stayers_held' } }],
          } },
        { id: 'give_night', title: 'Give them the night', icon: 'wait', check: check(HOLD, -10), minutes: 30, span: 'Hours',
          summary: 'You keep the street sealed and leave {others} to decide on {others.his} own, without {taker.first} and without you leaning on {others.him}. Your squad stays until the door opens, however long that is.',
          pull: 'Let them choose it, so it sticks.',
          cost: 'A long night on the corner, with nothing to do but wait.',
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
      summary: '{courier.first} and {owner.first} are safe outside, and {owner.first} was out before {taker.first} was. {taker.first} came out palms forward, the way the team told {taker.him}, and asked the nearest officer if someone could feed the cat in the back room. {owner.first} hadn’t known there was a cat.',
      epilogue: '{owner.first} reopened on Monday. The stool is in the back room now, and the cat sleeps on it.',
      epilogueIf: [
        { when: { marks: ['owner_admits'] }, epilogue: '{owner.first} called {taker.first}’s cousin on Monday. It took {owner.him} two tries to start.' },
        { when: { marks: ['camera_said'] }, epilogue: '{owner.first} kept the camera footage. {owner.He} never gave it to anyone.' },
      ] },
    out_the_back: { title: 'Out the back', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} got out the front. {taker.first} left by the alley, the way {taker.he} asked to, away from the crowd and the phones at the tape, and officers have {taker.him} now. {owner.first} watched the mouth of the alley from the patrol car until the last officer came out of it.',
      epilogue: '{taker.first} kept {taker.his} head down the whole length of the alley, past the one window with a light on.' },
    out_by_dawn: { title: 'Out by morning', disposition: 'resolved',
      summary: '{courier.first} and {owner.first} have been outside for hours, on the back step of the ambulance. {taker.first} came out after the long night and is in the team’s hands. {place} won’t open today, and the sign in the window still says CLOSED.',
      epilogue: '{owner.first} asked twice in the night whether anyone had brought {taker.first} something to eat.' },
    group_out: { title: 'The last shift came out', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} came through unhurt. Officers have {taker.first}, and {others} too, who came out one after another with their hands where the team could see them. The last of the last shift.',
      epilogue: '{others.first} still had {others.his} name tag from the place on.' },
    group_out_dawn: { title: 'Out with the daylight', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} were out long before the rest. By morning {taker.first} and everyone who came with {taker.him} are with the team, gray in the face after a night behind a counter that isn’t theirs anymore.',
      epilogue: '{others.first} came out at first light still wearing the place apron.' },
    entry_clean: { title: 'Out through an entry', disposition: 'resolved',
      summary: '{owner.first} and {courier.first} are on the sidewalk, unhurt, and officers have {taker.first}, the handgun in an evidence bag. {owner.first} won’t go back behind the counter tonight. {owner.He} {owner~asks|ask} an officer to turn the lights off and leave the radio on.',
      epilogue: '{owner.first} sold the place that spring. {owner.He} never stood behind that counter again.' },
    entry_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{owner.first} is getting care at the curb, hurt in the entry, one arm held tight against {owner.his} side. {courier.first} is safe. Officers are holding {taker.first}, who keeps asking whether {owner.first} is all right. {owner.first} asks someone to lock up for {owner.him}.',
      epilogue: '{owner.first} hasn’t said {taker.first}’s name since, not to the officers and not to the nurse who asked.' },
    went_in_for_owner: { title: 'Carried out', disposition: 'resolved',
      summary: 'The team went in for {owner.first}, who is in the ambulance now with the medic working over {owner.him}. {courier.first} is unhurt. {taker.first} was taken without a scratch and kept watching the ambulance until it turned the corner.',
      epilogue: '{courier.first} drove the rest of the route that night and couldn’t remember a single stop.' },
    went_in_taker_hurt: { title: 'Carried out, both of them', disposition: 'resolved',
      summary: '{taker.first} took the worst of it, and a medic is with {taker.him} on the floor. {owner.first} went in a second ambulance. {courier.first} is safe on the sidewalk, still holding the parcel.',
      epilogue: '{taker.first} kept {taker.his} eyes on the second ambulance until its doors shut.' },
    owner_killed: { title: '{owner.He} didn’t come out', disposition: 'relief_partial',
      summary: '{owner.first} died at {owner.his} own counter, twenty-two years after {owner.he} first unlocked the door. Officers hold {taker.first}, who isn’t hurt and hasn’t said a word since. {courier.first} is sitting in the patrol car with the delivery slip still blank.',
      epilogue: '{courier.first} still drives that route. {courier.He} {courier~takes|take} the long way around the block now.' },
    owner_killed_taker_hurt: { title: 'Two carried out', disposition: 'relief_partial',
      summary: '{taker.first} is hurt, and the crew is working on {taker.him}. {owner.first} died before the team reached {owner.him}, on the floor behind the register where {owner.he} kept the ledger. {courier.first} is safe in a patrol car now and won’t let go of the door handle.',
      epilogue: 'In the ambulance {taker.first} said {owner.first}’s name for the first time all day.' },
    owner_collapsed: { title: '{owner.He} collapsed at the counter', disposition: 'relief_partial', remainingTasks: ['Talk {taker.first} out from behind the counter'],
      summary: '{owner.first} went out on a stretcher after collapsing at the till, with a medic’s hand flat on {owner.his} chest the whole way to the ambulance. {courier.first} came out safe. {taker.first} stayed inside, still armed, with nobody left to hold.',
      epilogue: 'The till drawer was still open when they carried {owner.first} out. Nobody had counted it.' },
    owner_left_down: { title: 'Still on the floor', disposition: 'relief_partial', remainingTasks: ['Get {owner.first} to the medic', 'Bring {taker.first} out of there alive'],
      summary: '{owner.first} is lying on the floor near {taker.first}, and nobody outside can reach {owner.him}. The medic is waiting at the corner with everything ready, and command holds the block.',
      epilogue: '{courier.first} wouldn’t leave the tape until past midnight, and couldn’t say why.' },
    owner_beaten: { title: '{owner.He} signed', disposition: 'relief_partial', remainingTasks: ['Get {taker.first} to put the handgun down'],
      summary: 'Medics have {owner.first}, hurt. {owner.His} name is on the page folded in {taker.first}’s shirt pocket. {courier.first} is safe. {taker.first} hasn’t come out.',
      epilogue: '{owner.first} told the medic the name on the page wasn’t {owner.hers}. {owner.His} hand had shaken too hard to write it.' },
    taker_held: { title: 'Behind the counter', disposition: 'relief_partial', remainingTasks: ['Talk {taker.first} out of the place'],
      summary: '{courier.first} and {owner.first} are out of harm’s way. {taker.first} is holding out behind the counter with the handgun, and patrol keeps the street shut. The lights inside are still on.',
      epilogue: 'Some of the regulars stayed at the tape all night. A few of them had known {taker.first} six years.' },
    stayers_held: { title: 'Someone stayed', disposition: 'relief_partial', remainingTasks: ['Talk the rest of that shift outside'],
      summary: '{owner.first} and {courier.first} made it out, and {taker.first} walked out to officers. Not everyone who came in with {taker.him} has come out, and the block stays closed.',
      epilogue: '{taker.first} kept asking an officer whether the others were out yet.' },
    held_inside: { title: 'Still inside at the counter', disposition: 'relief_partial', remainingTasks: ['Get {owner.first} away from the till', 'Bring everyone else out alive'],
      summary: 'Command holds the street, with the team at the perimeter. {owner.first} is still inside with {taker.first} and the handgun, and the team calls the counter every half hour.',
      epilogue: '{owner.first}’s reading glasses stayed folded on the till all night.' },
    held_both: { title: 'Both still inside', disposition: 'relief_partial',
      remainingTasks: ['Walk {courier.first} out to patrol', 'Get {owner.first} off that stool', 'Talk {taker.first} into putting the handgun down'],
      summary: 'Patrol has the block sealed. {courier.first} and {owner.first} are both still in there with {taker.first}, who is armed, and {courier.first}’s van is still idling at the curb.',
      epilogue: '{courier.first}’s phone kept buzzing on the boxes. Eleven deliveries left, every one of them late.' },
    held_both_down: { title: 'Two inside, no medic yet', disposition: 'relief_partial',
      remainingTasks: ['Get a medic to {owner.first}', 'Bring {courier.first} out safely', 'Talk {taker.first} into setting the handgun aside'],
      summary: 'The street stays closed. {owner.first} has collapsed inside, and {courier.first} is still in there, a few steps from {taker.first}.',
      epilogue: '{courier.first} counted every trip the medic made to the corner and back.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get everyone out safely'],
      summary: 'Command still holds the street, and the call is still open. The team has no step left that it can take from here.',
      epilogue: '{owner.first} was still on the stool when the next shift dialed the counter phone.' },
  },
  rewards: { funding: 2600, trust: 6, xp: 45 },
};
