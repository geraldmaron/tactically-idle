import type { CallTree, TreeChoice, TreeOutcome } from './types';

// Behind the Bathroom Door: a barricade. A man has come into his ex-partner's home with a rifle,
// against a protective order, and threatened her. She got out; her son, 16, is hiding in the
// bathroom. The man wants to talk to her, which the team cannot give him (family never goes on
// the line). Hidden truth: whether he knows the {child^boy|girl|kid} is in the house (knows_son), and whether he
// will come out for a written message rather than seeing her (comes_out). A visible threat, and
// only that, makes going in possible: him at the bathroom door with the rifle.
//
// Self-harm screen (E4): applies. A breakup under a protective order, the apartment he lost, a
// rifle and a refusal. No path shows his death (E4.5); the worst shown is the crew taking him with
// the medic still working. Content note and 988 debrief line drafted, pending O2 and R5.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const QUIET = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.5 }, { key: 'awareness', weight: 0.5 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
type Base = typeof TALK | typeof HOLD | typeof QUIET | typeof MOVE | typeof ENTER;
const check = (base: Base, difficulty = 0): TreeChoice['check'] => ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

/** When he knows the {child^boy|girl|kid} is there, losing him sends him to the bathroom door: the threat. When he
 * doesn't, he goes quiet in the front room and the call carries on without contact. */
const ifHeKnows = (threat: string, quiet: TreeOutcome, pressure = 10): TreeOutcome[] => [
  { if: { fact: 'knows_son', is: true }, text: threat, reveal: ['knows_son'], mark: ['rifle_at_door'], next: { node: 'threat' }, pressure: pressure + 2 },
  { if: { fact: 'knows_son', is: false }, ...quiet, reveal: ['knows_son'] },
];

/** Going in on the threat. After a shot at the team it is harder, and the outcomes are the same. */
const goIn = (difficulty: number): TreeChoice => ({ id: 'go_in', title: 'Send the team in', icon: 'shield', check: check(ENTER, difficulty), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
    requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
    summary: 'Anyone in that hallway can be badly hurt, {child.first} included. The team goes in while {subject.first} stands at the bathroom door.',
    preview: { favorable: 'The team reaches {child.first} and gets {child.him} out.', mixed: 'The team gets {child.first} out, and {subject.first} is hurt when they take the rifle.', adverse: 'The team gets {child.first} out late, and someone in that hallway is badly hurt.' },
    outcomes: {
      favorable: [{ text: 'The team is in the hallway before {subject.first} turns. {child.first} is out the front, and {subject.first} is with the team, the rifle out of {subject.his} reach.', safe: ['child'], out: ['subject'], next: { ending: 'entry_clean' }, objective: 50 }],
      mixed: [{ text: 'The team gets {child.first} out. {subject.first} is hurt when the team takes the rifle from {subject.him}, and the medic is with {subject.him} now.', safe: ['child'], harm: { subject: 'serious' }, out: ['subject'], next: { ending: 'entry_subject_hurt' }, objective: 36 }],
      adverse: [
        { if: { fact: 'comes_out', is: true }, text: 'The team gets {child.first} out, but {child.he} {child~cuts|cut} {child.his} arm on the bathroom door glass on the way. An officer is hurt taking the rifle. The medic is with {child.first}, and {subject.first} is with the team now.', reveal: ['comes_out'], officer: 'wounded', safe: ['child'], harm: { child: 'wounded' }, out: ['subject'], next: { ending: 'entry_son_hurt' }, objective: 24, civilian: -15 },
        { if: { fact: 'comes_out', is: false }, text: '{subject.first} turns the rifle on the team in the hallway while they carry {child.first} out past {subject.him}.', reveal: ['comes_out'], safe: ['child'], force: { on: 'subject', next: { hurt: { ending: 'subject_shot' }, none: { ending: 'entry_clean' } }, noFatal: true }, objective: 20 },
      ],
    } });

export const BARRICADE_ORDER: CallTree = {
  type: 'barricaded',
  title: 'Behind the Bathroom Door',
  roles: [
    { id: 'subject', label: '{ex.his} ex-partner', pronouns: 'he', kind: 'subject', carries: { label: 'Rifle', glyph: 'weapon', knownFrom: 'rifle' } },
    { id: 'child', label: '{ex.his} {child^son|daughter|child}, {child.age}', pronouns: 'he', kind: 'civilian', place: { rooms: ['bathroom'] }, surnameGroup: 'family' },
    { id: 'ex', label: 'the resident', pronouns: 'she', kind: 'bystander', surnameGroup: 'family' },
  ],
  families: ['cedar_close', 'harbour_court', 'willow_terrace_v1', 'ash_grove_v1', 'juniper_court_v1', 'bungalow_g2', 'two_storey_house_g2', 'semi_detached_g2', 'apartment_unit_g2'],
  scene: { setting: ['residential', 'apartment'], rooms: ['living', 'kitchen'], timeOfDay: 'dusk', crowd: 1 },
  summary: '{child} is hiding in the bathroom, {child.his} phone nearly dead. {child.His} {ex^father|mother|parent}’s ex is in the front room with a rifle.',
  pressureLabel: '{child.first} behind the door',
  pressure: { start: 22, perMinute: 0.25, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{ex} ran from {ex.his} home after {subject.first}, {ex.his} ex-partner, came in with a rifle against a protective order and threatened {ex.him}. {subject.He} won’t come out, and {ex.his} {child^son|daughter|child} is still inside.',
    known: [
      '{ex.first} got out with a neighbor’s help. {ex.He} {ex~says|say} {child.first} is hiding in the bathroom.',
      '{child.first} texted {child.his} {ex^father|mother|parent}, “{subject.He} {subject~doesn’t|don’t} know I’m here.” Patrol has not seen {child.him}.',
      'Patrol saw {subject.first} at the front window with a rifle. {subject.He} shouted that {subject.he} {subject~isn’t|aren’t} leaving until {ex.first} talks to {subject.him}.',
    ],
    unknown: ['Whether {subject.first} knows {child.first} is in the house'],
    responsibilities: ['Get {child.first} out', 'Keep {ex.first} back and off the phone', 'Bring {subject.first} out alive'],
  },
  stageLabels: { assess: 'At the window', adapt: 'The house goes quiet', resolve: 'Who comes out' },
  objectives: [
    { id: 'child', label: 'Get {child.first} out' },
    { id: 'ex', label: 'Keep {ex.first} out of it' },
    { id: 'subject', label: 'Bring {subject.first} out alive' },
  ],
  // The rifle at the bathroom door is the threat to life that opens going in (sim/authorization.ts).
  // The rifle at the front window is not: it is why the team is here, not a reason to go in.
  threatMarks: { rifle_at_door: '{subject.first} took the rifle to the door {child.first} is hiding behind' },
  facts: {
    rifle: { public: true, truth: true, source: 'Responding patrol', label: 'Patrol’s rifle report',
      claim: 'Patrol saw {subject.first} at the front window holding a rifle.',
      confirmed: 'Patrol saw the rifle again at the front window.', disproved: 'Patrol could not see the rifle again.' },
    knows_son: { label: 'Whether {subject.first} knows about {child.first}', claim: 'Whether {subject.first} knows {child.first} is in the house.',
      confirmed: '{subject.first} knows {child.first} is in the bathroom.', disproved: '{subject.first} believes {subject.he} {subject~is|are} alone in the house.' },
    comes_out: { label: '{subject.first}’s terms', claim: 'Whether {subject.first} will come out without seeing {ex.first}.',
      confirmed: '{subject.first} will come out if someone takes down what {subject.he} {subject~wants|want} {ex.first} to know.', disproved: '{subject.first} says {subject.he} {subject~stays|stay} until {ex.first} comes to the door.' },
  },
  situations: [
    { note: '{subject.He} {subject~thinks|think} the house is empty and {subject~wants|want} to be heard. A written message will bring {subject.him} out.', truth: { knows_son: false, comes_out: true } },
    { note: '{subject.He} {subject~knows|know} the {child^boy|girl|kid} is there and would never say so first. A written message will still bring {subject.him} out.', truth: { knows_son: true, comes_out: true } },
    { note: '{subject.He} {subject~knows|know} the {child^boy|girl|kid} is there and won’t leave without seeing {ex.him}. Pressed, {subject.he} {subject~goes|go} to the bathroom door.', truth: { knows_son: true, comes_out: false } },
  ],
  turns: { quiet: ['quiet_dog', 'quiet_battery', 'quiet_her_phone'] },
  difficulty: { base: 40, perTier: 4 },
  root: 'window',
  nodes: [
    // ------------------------------------------------------------------ stage 1
    { id: 'window', stage: 'assess',
      prompt: '{subject.first} is at the front window shouting for {ex.first}. {child.first} stopped texting four minutes ago.',
      choices: [
        { id: 'call_him', title: 'Call {subject.first}’s cell', icon: 'radio', talksTo: 'subject', check: check(TALK), minutes: 3,
          summary: '{lead} calls {subject.first} while {subject.he} {subject~is|are} still at the front window. {subject.His} attention stays out front, and so does {subject.his} anger.',
          preview: { favorable: '{subject.first} answers and stays at the front window.', mixed: '{subject.first} answers, and the first thing {subject.he} {subject~asks|ask} for is {ex.first}.', adverse: '{subject.first} lets it ring and leaves the window, where nobody can see {subject.him}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} picks up on the second ring and stays at the window, where the team can see {subject.him}.', next: { node: 'on_the_line' }, objective: 12 }],
            mixed: [{ text: '{subject.first} picks up and says {subject.he} {subject~talks|talk} to {ex.first} or nobody.', mark: ['wants_her'], next: { node: 'on_the_line' }, objective: 8 }],
            adverse: [{ text: '{subject.first} lets the phone ring out and steps back from the window. The team loses sight of {subject.him}.', next: { turn: 'quiet' }, pressure: 6 }],
          } },
        { id: 'son_stay', title: 'Text {child.first} to stay put', icon: 'search', check: check(QUIET), minutes: 2,
          summary: '{lead} texts {child.first} to lock the door, get down and silence the phone. If the text buzzes, {subject.first} may hear it.',
          preview: { favorable: '{child.first} answers, and you know exactly where {child.he} {child~is|are}.', mixed: '{child.first} answers once, then goes quiet to save the battery.', adverse: '{child.first}’s phone buzzes before it goes silent. If {subject.first} knows about {child.him}, {subject.he} {subject~goes|go} looking with the rifle.' },
          outcomes: {
            favorable: [{ text: '{child.first} texts back that the bathroom door is locked and {child.he} {child~is|are} on the floor behind the tub.', mark: ['son_steady'], next: { turn: 'quiet' }, objective: 10 }],
            mixed: [{ text: '{child.first} answers “ok,” then stops answering. {child.His} battery is almost gone, and as far as anyone knows {child.he} {child~is|are} still in the bathroom.', mark: ['son_dark'], next: { turn: 'quiet' }, objective: 5 }],
            adverse: ifHeKnows('{child.first}’s phone buzzes. The team sees {subject.first} leave the window and go toward the bathroom with the rifle.',
              { text: '{child.first}’s phone buzzes, then dies. {subject.first} stops shouting, listens, and goes back to the window.', next: { turn: 'quiet' }, mark: ['son_dark'], pressure: 6 }),
          } },
        { id: 'ex_back', title: 'Move {ex.first} behind the patrol cars', icon: 'perimeter', check: check(MOVE, -4), minutes: 2,
          summary: '{ex.first} goes where {subject.first} can’t see {ex.him}. {subject.He} {subject~loses|lose} the person {subject.he} {subject~is|are} shouting at, and you lose sight of where {subject.he} {subject~goes|go} next.',
          preview: { favorable: '{ex.first} moves back, and {subject.first} goes quiet at the window.', mixed: '{ex.first} moves back, calling {subject.his} name the whole way.', adverse: '{ex.first} won’t move while {ex.his} {child^son|daughter|child} is inside, and {subject.first} shouts louder.' },
          outcomes: {
            favorable: [{ text: '{ex.first} sits in the back of a patrol car with the door shut. {subject.first} stops shouting and lets the curtain fall.', mark: ['ex_hidden'], next: { turn: 'quiet' }, objective: 10, pressure: -4 }],
            mixed: [{ text: '{ex.first} goes behind the cars, calling {subject.first}’s name until patrol walks {ex.him} to the corner.', mark: ['ex_hidden'], next: { turn: 'quiet' }, pressure: 3 }],
            adverse: [{ text: '{ex.first} says {ex.he} {ex~isn’t|aren’t} moving while {ex.his} {child^son|daughter|child} is in there. {subject.first} calls 911 to shout about {ex.him}, and the team takes the call.', mark: ['wants_her'], next: { node: 'on_the_line' }, pressure: 6 }],
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: talking
    { id: 'on_the_line', stage: 'adapt',
      prompt: '{subject.first} is on the line from the front room. {subject.He} {subject~wants|want} {ex.first} at the door.',
      promptIf: [{ when: { marks: ['wants_her'] }, prompt: '{subject.first} says {subject.he} {subject~talks|talk} to {ex.first} or nobody. {child.first} is still in the bathroom.' }],
      choices: [
        { id: 'honest_no', title: 'Tell {subject.him} {ex.first} isn’t coming', icon: 'radio', talksTo: 'subject', check: check(TALK, 3), minutes: 3,
          summary: '{lead} tells {subject.first} plainly that {ex.first} won’t talk to {subject.him} tonight. {subject.He} can hang up on the person who said it.',
          preview: { favorable: '{subject.first} goes quiet, then keeps talking to you instead.', mixed: '{subject.first} keeps talking, but {subject.he} {subject~swears|swear} at you first.', adverse: '{subject.first} hangs up, and if {subject.he} {subject~knows|know} about {child.first}, {subject.he} {subject~goes|go} looking for {child.him}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} is quiet for a long time. Then {subject.he} {subject~asks|ask} if {ex.first} is all right.', moves: { subject: 'honest' }, next: { node: 'son_inside' }, objective: 12, pressure: -4 }],
            mixed: [{ text: '{subject.first} swears at the team for a minute and doesn’t hang up.', moves: { subject: ['honest', 'provoked'] }, next: { node: 'son_inside' }, objective: 6 }],
            adverse: ifHeKnows('{subject.first} hangs up. The officer at the side window sees {subject.him} leave the front room with the rifle and stop at the bathroom door.',
              { text: '{subject.first} hangs up, then picks up again on the third call without a word.', next: { node: 'son_inside' }, moves: { subject: 'provoked' }, pressure: 6 }),
          } },
        { id: 'who_else', title: 'Ask {subject.him} who else is in the house', icon: 'intel', talksTo: 'subject', check: check(TALK, 2), minutes: 3, consequenceLevel: 'high',
          summary: '{lead} asks {subject.first} whether anyone else is inside. If {subject.he} {subject~doesn’t|don’t} know about {child.first}, the question tells {subject.him}.',
          preview: { favorable: '{subject.first} answers, and you learn whether {subject.he} {subject~knows|know} about {child.first}.', mixed: '{subject.first} answers, then asks why you want to know.', adverse: '{subject.first} goes looking for whoever you meant, with the rifle.' },
          outcomes: {
            favorable: [
              { if: { fact: 'knows_son', is: true }, text: '{subject.first} says the {child^boy|girl|kid} is in the bathroom and {subject.he} would never hurt {subject.him}.', reveal: ['knows_son'], mark: ['said_son'], next: { node: 'son_inside' }, objective: 14 },
              { if: { fact: 'knows_son', is: false }, text: '{subject.first} says it is just {subject.him}. {subject.He} {subject~doesn’t|don’t} ask why the team wants to know.', reveal: ['knows_son'], mark: ['thinks_alone'], next: { node: 'son_inside' }, objective: 14 },
            ],
            mixed: [
              { if: { fact: 'knows_son', is: true }, text: '{subject.first} says the {child^boy|girl|kid} is in the bathroom, then asks why that matters to anyone.', reveal: ['knows_son'], mark: ['said_son'], moves: { subject: 'provoked' }, next: { node: 'son_inside' }, objective: 8 },
              { if: { fact: 'knows_son', is: false }, text: '{subject.first} says it is just {subject.him}, then asks twice who the team thinks is in there.', reveal: ['knows_son'], mark: ['thinks_alone'], moves: { subject: 'provoked' }, next: { node: 'son_inside' }, objective: 8 },
            ],
            adverse: [{ text: '{subject.first} drops the phone. Through the side window the team sees {subject.him} go room to room with the rifle and stop at the bathroom door.', mark: ['rifle_at_door'], next: { node: 'threat' }, pressure: 12 }],
          } },
        { id: 'let_him_talk', title: 'Let {subject.him} talk about {ex.first}', icon: 'wait', talksTo: 'subject', check: check(HOLD, -6), minutes: 12,
          summary: '{lead} lets {subject.first} talk about the last two years. {child.first} spends every minute of it on the bathroom floor.',
          preview: { favorable: '{subject.first} talks {subject.himself} tired and starts listening.', mixed: '{subject.first} talks in circles, and {child.first} waits through all of it.', adverse: '{subject.first} gets louder and stops listening.' },
          outcomes: {
            favorable: [{ text: '{subject.first} talks about the order, the apartment {subject.he} lost and the last birthday party. Then {subject.he} {subject~asks|ask} what happens to {subject.him} now.', moves: { subject: 'heard' }, next: { node: 'son_inside' }, objective: 12, pressure: -6 }],
            mixed: [{ text: '{subject.first} tells the same story three times. Each time it ends with {ex.first} calling the police.', moves: { subject: 'heard' }, next: { node: 'son_inside' }, minutes: 6 }],
            adverse: [{ text: '{subject.first} talks {subject.himself} angrier and says {subject.he} {subject~is|are} done talking to strangers. {subject.He} {subject~stays|stay} on the line, breathing.', moves: { subject: 'provoked' }, next: { node: 'son_inside' }, pressure: 4 }],
          } },
      ] },

    // ------------------------------------------------------------------ stage 2: the quiet house (one turn per call)
    { id: 'quiet_dog', stage: 'adapt',
      prompt: 'The house has gone quiet. The family dog is barking at the bathroom door and won’t stop.',
      promptIf: [{ when: { marks: ['ex_hidden'] }, prompt: 'With {ex.first} out of sight, the house has gone quiet. The family dog is barking at the bathroom door.' }],
      choices: [
        { id: 'pull_front', title: 'Call {subject.first} to pull {subject.him} out front', icon: 'radio', talksTo: 'subject', check: check(TALK), minutes: 2,
          summary: '{lead} calls {subject.first} so {subject.he} {subject~comes|come} back to the front room and away from the dog. You have no plan yet for {child.first}.',
          preview: { favorable: '{subject.first} answers from the front room.', mixed: '{subject.first} answers, shouting about the dog.', adverse: '{subject.first} goes to see what the dog is barking at, rifle in hand.' },
          outcomes: {
            favorable: [{ text: '{subject.first} answers from the front room and tells the dog to shut up.', next: { node: 'son_inside' }, objective: 10 }],
            mixed: [{ text: '{subject.first} answers and says the dog won’t shut up. {subject.He} {subject~puts|put} it out the back.', moves: { subject: 'provoked' }, next: { node: 'son_inside' }, objective: 6 }],
            adverse: ifHeKnows('{subject.first} doesn’t answer. The officer at the side window sees {subject.him} follow the dog to the bathroom door, the rifle in {subject.his} hands.',
              { text: '{subject.first} lets it ring three times, then answers shouting and puts the dog out the back.', next: { node: 'son_inside' }, moves: { subject: 'provoked' }, pressure: 4 }),
          } },
        { id: 'under_barking', title: 'Bring {child.first} out under the barking', icon: 'door', walks: 'child', check: check(QUIET, 4), minutes: 3, consequenceLevel: 'high',
          modifiers: [{ label: '{child.first} is ready and waiting', mark: 'son_steady', value: 8 }, { label: 'No way to reach {child.first}', mark: 'son_dark', value: -8 }],
          summary: '{lead} gets {child.first} moving while the dog covers the sound. If {subject.first} turns around, {subject.he} {subject~sees|see} {child.first} go.',
          preview: { favorable: '{child.first} gets out while the dog barks.', mixed: '{child.first} gets out, and {subject.first} hears the door close behind {child.him}.', adverse: '{subject.first} catches {child.first} on the way out, and the rifle is in {subject.his} hands.' },
          outcomes: {
            favorable: [{ text: '{child.first} slips out while the dog barks and walks to patrol in {child.his} socks.', safe: ['child'], next: { node: 'son_out' }, objective: 40 }],
            mixed: [{ text: '{child.first} gets out. {subject.first} hears the door and comes shouting into the hallway, too late to see who went.', safe: ['child'], moves: { subject: 'provoked' }, next: { node: 'son_out' }, objective: 34, pressure: 6 }],
            adverse: [{ text: '{subject.first} turns as {child.first} crosses the house and points the rifle at {child.him}. {child.first} backs into the bathroom.', mark: ['rifle_at_door'], next: { node: 'threat' }, pressure: 14 }],
          } },
      ] },
    { id: 'quiet_battery', stage: 'adapt',
      prompt: '{child.first}’s last text says {child.his} battery is at 2 percent. {subject.first} is somewhere in the house, and nobody can see {subject.him}.',
      promptIf: [
        { when: { marks: ['son_dark'] }, prompt: '{child.first}’s phone has gone quiet. {subject.first} is somewhere in the house, and nobody can see {subject.him}.' },
        { when: { marks: ['ex_hidden'] }, prompt: 'With {ex.first} out of sight, {subject.first} has left the window. {child.first}’s battery is at 2 percent.' },
      ],
      choices: [
        { id: 'timed_exit', title: 'Time {child.first}’s exit to your call', icon: 'door', walks: 'child', check: check(QUIET, 2), minutes: 3, consequenceLevel: 'high',
          modifiers: [{ label: '{child.first} is ready and waiting', mark: 'son_steady', value: 6 }, { label: 'No way to reach {child.first}', mark: 'son_dark', value: -8 }],
          summary: '{lead} texts {child.first} to walk out the moment {subject.first}’s phone rings, then calls. It only works if {subject.first} answers.',
          preview: { favorable: '{subject.first} answers, and {child.first} walks out while {subject.he} {subject~talks|talk}.', mixed: '{child.first} walks out, and {subject.first} hears {child.him} go.', adverse: '{subject.first} doesn’t answer, and {child.first} may open the bathroom door with {subject.him} and the rifle in the house.' },
          outcomes: {
            favorable: [{ text: '{subject.first} answers, and {child.first} walks out while {subject.he} {subject~is|are} talking. Patrol has the {child^boy|girl|kid} before the call ends.', safe: ['child'], next: { node: 'son_out' }, objective: 40 }],
            mixed: [{ text: '{child.first} walks out. {subject.first} hears the door mid-sentence and hangs up.', safe: ['child'], moves: { subject: 'provoked' }, next: { node: 'son_out' }, objective: 32, pressure: 6 }],
            adverse: ifHeKnows('{subject.first} doesn’t answer. {child.first} opens the bathroom door, sees {subject.him} there with the rifle, and shuts it again.',
              { text: '{subject.first} doesn’t answer, and {child.first}’s phone dies before {child.he} {child~reads|read} the text. {child.He} {child~stays|stay} in the bathroom.', next: { node: 'son_inside' }, mark: ['son_dark'], pressure: 6 }),
          } },
        { id: 'keep_him_busy', title: 'Call {subject.first} and keep {subject.him} talking', icon: 'radio', talksTo: 'subject', check: check(TALK, -2), minutes: 3,
          summary: '{lead} calls and keeps {subject.first} on the line. {child.first}’s phone dies while you talk, and you lose your only way to reach {child.him}.',
          preview: { favorable: '{subject.first} talks, and {child.first} stays hidden.', mixed: '{subject.first} talks, but only about {ex.first}.', adverse: '{subject.first} answers shouting, and {child.first}’s phone dies mid-text.' },
          outcomes: {
            favorable: [{ text: '{subject.first} answers and starts talking. {child.first}’s last text says “ok.”', mark: ['son_dark'], next: { node: 'son_inside' }, objective: 10 }],
            mixed: [{ text: '{subject.first} answers and talks only about {ex.first}. {child.first}’s phone goes dark during the call.', mark: ['son_dark', 'wants_her'], next: { node: 'son_inside' }, objective: 6 }],
            adverse: [{ text: '{subject.first} answers shouting and asks who keeps texting in {subject.his} house. {child.first}’s phone dies mid-reply.', mark: ['son_dark'], moves: { subject: 'provoked' }, next: { node: 'son_inside' }, pressure: 6 }],
          } },
      ] },
    { id: 'quiet_her_phone', stage: 'adapt',
      prompt: '{subject.first} is calling {ex.first}’s cell over and over. {ex.He} {ex~wants|want} to answer and tell {subject.him} to leave.',
      promptIf: [{ when: { marks: ['ex_hidden'] }, prompt: '{subject.He} can’t see {ex.first} anymore, so {subject.first} is calling {ex.his} cell over and over. {ex.He} {ex~wants|want} to answer.' }],
      choices: [
        { id: 'keep_her_off', title: 'Keep {ex.first} off the phone', icon: 'perimeter', check: check(MOVE), minutes: 4,
          summary: '{ex.first} hands patrol {ex.his} phone and argues the whole time. {subject.first} hears it ring out again and again.',
          preview: { favorable: '{subject.first} gives up on {ex.his} phone and answers yours.', mixed: '{subject.first} answers yours, but only to ask for {ex.him}.', adverse: '{subject.first} hears the phone ring out once too often. If {subject.he} {subject~knows|know} about {child.first}, {subject.he} {subject~goes|go} looking for {child.him}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} gives up on {ex.first}’s phone. When the team calls, {subject.he} {subject~picks|pick} up.', next: { node: 'son_inside' }, objective: 10 }],
            mixed: [{ text: '{subject.first} picks up the team’s call and asks for {ex.first} before anything else.', mark: ['wants_her'], next: { node: 'son_inside' }, objective: 6 }],
            adverse: ifHeKnows('{subject.first} stops calling. Through the side window the team sees {subject.him} at the bathroom door with the rifle, knocking.',
              { text: '{subject.first} stops calling and sits in the dark front room. {subject.He} {subject~picks|pick} up on the team’s fourth try.', next: { node: 'son_inside' }, moves: { subject: 'provoked' }, pressure: 6 }),
          } },
        { id: 'answer_hers', title: 'Answer {ex.his} phone as the team', icon: 'radio', talksTo: 'subject', check: check(TALK, 2), minutes: 3,
          summary: '{lead} answers {ex.first}’s phone. {subject.first} hears a stranger where {subject.he} wanted {ex.him}, and {ex.first} hears every word.',
          preview: { favorable: '{subject.first} keeps talking to the voice on {ex.his} phone.', mixed: '{subject.first} keeps talking, and {ex.first} shouts over the officer.', adverse: '{subject.first} hears a stranger on {ex.his} phone and hangs up. If {subject.he} {subject~knows|know} about {child.first}, {subject.he} {subject~goes|go} to {child.him}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} asks who this is, then keeps talking.', next: { node: 'on_the_line' }, objective: 10 }],
            mixed: [{ text: '{subject.first} keeps talking. {ex.first} shouts over the officer until patrol walks {ex.him} away.', mark: ['wants_her'], next: { node: 'on_the_line' }, objective: 6 }],
            adverse: ifHeKnows('{subject.first} hangs up. The officer at the side window sees {subject.him} go to the bathroom door with the rifle.',
              { text: '{subject.first} hangs up on the stranger, then calls the team back ten minutes later.', next: { node: 'son_inside' }, moves: { subject: 'provoked' }, minutes: 6 }),
          } },
      ] },

    // ------------------------------------------------------------------ stage 3
    { id: 'son_inside', stage: 'resolve',
      prompt: '{subject.first} is on the line. {child.first} is still behind the bathroom door.',
      promptIf: [
        { when: { marks: ['thinks_alone'] }, prompt: '{subject.first} thinks {subject.he} {subject~is|are} alone in the house. {child.first} is still behind the bathroom door.' },
        { when: { marks: ['said_son'] }, prompt: '{subject.first} says {subject.he} would never hurt the {child^boy|girl|kid}. {child.first} is still behind the bathroom door.' },
        { when: { marks: ['son_dark'] }, prompt: '{child.first}’s phone is dead, and the bathroom door is still shut. {subject.first} is still in the house with the rifle.' },
      ],
      choices: [
        { id: 'write_message', title: 'Take down {subject.his} message', icon: 'handover', talksTo: 'subject', check: check(TALK), minutes: 8, authority: { concede: 'statement' },
          summary: '{lead} writes down what {subject.first} wants {ex.first} to know. Nobody will hand the page to {ex.first}, and {subject.he} will hear that.',
          preview: { favorable: '{subject.first} says {subject.his} piece and decides whether to come out.', mixed: '{subject.first} says {subject.his} piece and stays in the front room for now.', adverse: '{subject.first} hears that it won’t reach {ex.him}. If {subject.he} {subject~knows|know} about {child.first}, {subject.he} {subject~goes|go} to {child.him}.' },
          outcomes: {
            favorable: [
              { if: { fact: 'comes_out', is: true }, text: '{subject.first} has the message read back twice. Then {subject.he} {subject~leaves|leave} the rifle on the couch and {subject~comes|come} out the front with {subject.his} hands open. The team has {subject.him}.', reveal: ['comes_out'], out: ['subject'], next: { ending: 'everyone_out' }, objective: 50 },
              { if: { fact: 'comes_out', is: true }, text: '{child.first} comes out after {subject.him} in {child.his} socks.', safe: ['child'] },
              { if: { fact: 'comes_out', is: false }, text: '{subject.first} says a note isn’t {ex.him}. The officer at the side window sees {subject.him} leave the front room with the rifle and stop at the bathroom door.', reveal: ['comes_out'], mark: ['rifle_at_door'], next: { node: 'threat' }, pressure: 10 },
            ],
            mixed: [
              { if: [{ fact: 'comes_out', is: true }, { fact: 'knows_son', is: true }], text: '{subject.first} says {subject.his} piece, then tells the team the {child^boy|girl|kid} can come out first. {child.first} walks out alone.', reveal: ['comes_out'], safe: ['child'], next: { node: 'son_out' }, objective: 40 },
              { if: [{ fact: 'comes_out', is: true }, { fact: 'knows_son', is: false }], text: '{subject.first} says {subject.his} piece and asks for a minute before {subject.he} {subject~comes|come} out. While {subject.he} {subject~talks|talk}, {child.first} walks out alone.', reveal: ['comes_out'], safe: ['child'], next: { node: 'son_out' }, objective: 40 },
              { if: { fact: 'comes_out', is: false }, text: '{subject.first} says {subject.his} piece and still wants {ex.first} at the door. {subject.He} {subject~doesn’t|don’t} move from the front room.', reveal: ['comes_out'], next: { ending: 'held_with_son' }, objective: 10 },
            ],
            adverse: ifHeKnows('{subject.first} hears that it won’t reach {ex.him} and goes to the bathroom door with the rifle.',
              { text: '{subject.first} says nobody is going to read it anyway and hangs up. {subject.He} {subject~stays|stay} in the front room.', next: { ending: 'held_with_son' } }),
          } },
        { id: 'walk_out_quiet', title: 'Walk {child.first} out while {subject.first} is unaware', icon: 'door', walks: 'child', check: check(QUIET, 2), minutes: 3, consequenceLevel: 'high', onlyIf: { marks: ['thinks_alone'] },
          modifiers: [{ label: '{child.first} is ready and waiting', mark: 'son_steady', value: 8 }, { label: 'No way to reach {child.first}', mark: 'son_dark', value: -8 }],
          summary: '{lead} keeps {subject.first} talking while {child.first} walks out. If {subject.first} hears {child.him}, {subject.he} {subject~learns|learn} there was someone in the house all along.',
          preview: { favorable: '{child.first} walks out while {subject.first} is talking.', mixed: '{child.first} gets out, and {subject.first} hears the door.', adverse: '{subject.first} hears {child.first} and goes to see, rifle in hand.' },
          outcomes: {
            favorable: [{ text: '{child.first} walks out while {subject.first} is still talking. Patrol has {child.him} at the curb.', safe: ['child'], next: { node: 'son_out' }, objective: 42 }],
            mixed: [{ text: '{child.first} gets out. {subject.first} hears the door and asks who just left {subject.his} house.', safe: ['child'], moves: { subject: 'provoked' }, next: { node: 'son_out' }, objective: 34, pressure: 6 }],
            adverse: [{ text: '{subject.first} hears a door and goes to see. {subject.He} {subject~finds|find} {child.first} in the hallway and {subject~points|point} the rifle at {child.him}, shouting. {child.first} backs into the bathroom.', mark: ['rifle_at_door'], next: { node: 'threat' }, pressure: 14 }],
          } },
        { id: 'ask_release', title: 'Ask {subject.him} to let {child.first} walk out', icon: 'radio', talksTo: 'subject', check: check(TALK, -2), minutes: 3, onlyIf: { marks: ['said_son'] },
          summary: '{subject.first} said {subject.he} would never hurt the {child^boy|girl|kid}. {lead} asks {subject.him} to show it, and if {subject.he} {subject~says|say} no, {subject.he} {subject~has|have} said it to your face.',
          preview: { favorable: '{subject.first} lets {child.first} walk out.', mixed: '{subject.first} lets {child.first} go, then stops talking.', adverse: '{subject.first} says the {child^boy|girl|kid} stays where {subject.he} {subject~is|are}, and may go to the bathroom door with the rifle.' },
          outcomes: {
            favorable: [{ text: '{subject.first} calls through the house that the {child^boy|girl|kid} can go. {child.first} walks out holding {child.his} dead phone.', safe: ['child'], next: { node: 'son_out' }, objective: 42 }],
            mixed: [{ text: '{subject.first} lets {child.first} go and then stops answering. The team can still see {subject.first} at the window.', safe: ['child'], moves: { subject: 'provoked' }, next: { node: 'son_out' }, objective: 34 }],
            adverse: [
              { if: { fact: 'comes_out', is: false }, text: '{subject.first} says the {child^boy|girl|kid} stays as long as {ex.first} stays away. Through the side window the team sees {subject.him} go to the bathroom door with the rifle.', reveal: ['comes_out'], mark: ['rifle_at_door'], next: { node: 'threat' }, pressure: 12 },
              { if: { fact: 'comes_out', is: true }, text: '{subject.first} says the {child^boy|girl|kid} is fine where {subject.he} {subject~is|are}, and the team can ask again later.', reveal: ['comes_out'], next: { ending: 'held_with_son' } },
            ],
          } },
        { id: 'past_dark', title: 'Keep {subject.him} on the line past dark', icon: 'wait', talksTo: 'subject', check: check(HOLD, -10), minutes: 40, span: 'Hours',
          summary: '{lead} stays on the line for as long as {subject.first} wants to talk. {child.first} spends the whole evening on the bathroom floor.',
          preview: { favorable: '{subject.first} decides by midnight, with {child.first} still waiting.', mixed: '{subject.first} decides after midnight, with {child.first} still on the floor.', adverse: '{subject.first} stops talking, and {child.first} is still inside.' },
          outcomes: {
            favorable: [
              { if: { fact: 'comes_out', is: true }, text: '{subject.first} says {subject.he} {subject~is|are} tired a little before midnight. {subject.He} {subject~comes|come} out with {subject.his} hands open, and the team has {subject.him}. {child.first} comes out after.', reveal: ['comes_out'], safe: ['child'], out: ['subject'], next: { ending: 'out_by_morning' }, objective: 45 },
              { if: { fact: 'comes_out', is: false }, text: '{subject.first} talks until midnight and still wants {ex.first} at the door. {child.first} is still in the bathroom.', reveal: ['comes_out'], next: { ending: 'held_with_son' }, objective: 10 },
            ],
            mixed: [
              { if: { fact: 'comes_out', is: true }, text: '{subject.first} comes out at two in the morning. {child.first} has fallen asleep on the bathroom floor and is carried out by patrol. The team has {subject.first}.', reveal: ['comes_out'], safe: ['child'], out: ['subject'], next: { ending: 'out_by_morning' }, objective: 40, minutes: 20 },
              { if: { fact: 'comes_out', is: false }, text: '{subject.first} stops answering after midnight. {child.first} is still in the bathroom.', reveal: ['comes_out'], next: { ending: 'held_with_son' }, minutes: 20 },
            ],
            adverse: [{ text: '{subject.first} stops answering and sits by the window in the dark. {child.first} is still in the bathroom.', next: { ending: 'held_with_son' } }],
          } },
      ] },
    { id: 'son_out', stage: 'resolve',
      prompt: '{child.first} is with {child.his} {ex^father|mother|parent} behind the patrol cars. {subject.first} is alone in the house with the rifle.',
      choices: [
        { id: 'talk_out', title: 'Talk {subject.him} out the front door', icon: 'radio', talksTo: 'subject', check: check(TALK, 6), minutes: 6,
          summary: '{lead} tells {subject.first} how to come out, hands open, with the street watching and {ex.first} behind the cars.',
          preview: { favorable: '{subject.first} comes out the front with {subject.his} hands open.', mixed: '{subject.first} comes out after a long stop at the door.', adverse: '{subject.first} won’t come out where {ex.first} might see {subject.him}.' },
          outcomes: {
            favorable: [{ text: '{subject.first} leaves the rifle inside and comes out the front with {subject.his} hands open, the way the team tells {subject.him}. The team has {subject.him}.', out: ['subject'], next: { ending: 'everyone_out' }, objective: 30 }],
            mixed: [{ text: '{subject.first} stands in the doorway for fifteen minutes, then comes out with {subject.his} hands open. The team has {subject.him}.', out: ['subject'], next: { ending: 'everyone_out' }, objective: 25, minutes: 15 }],
            adverse: [{ text: '{subject.first} says {subject.he} {subject~isn’t|aren’t} walking out with {ex.first} watching. {subject.He} {subject~shuts|shut} the front door.', next: { ending: 'son_out_held' }, objective: 5 }],
          } },
        { id: 'message_now', title: 'Write down {subject.his} message', icon: 'handover', talksTo: 'subject', check: check(TALK, -2), minutes: 8, authority: { concede: 'statement' },
          summary: '{lead} writes down {subject.first}’s words to {ex.first}, and the page stays with the team. With {child.first} out, the page is all {subject.he} still {subject~wants|want}.',
          preview: { favorable: '{subject.first} says {subject.his} piece and comes out.', mixed: '{subject.first} says {subject.his} piece and comes out near dawn.', adverse: '{subject.first} says a note isn’t enough and stays inside.' },
          outcomes: {
            favorable: [{ text: '{subject.first} has the message read back, then comes out with {subject.his} hands open. The team has {subject.him}.', out: ['subject'], next: { ending: 'everyone_out' }, objective: 30 }],
            mixed: [{ text: '{subject.first} changes the message four times and comes out near dawn with {subject.his} hands open. The team has {subject.him}.', out: ['subject'], next: { ending: 'out_by_morning' }, objective: 25, minutes: 30 }],
            adverse: [{ text: '{subject.first} says a note isn’t {ex.him}, and stops answering.', next: { ending: 'son_out_held' } }],
          } },
        { id: 'let_him_decide', title: 'Hold the perimeter and let {subject.him} decide', icon: 'wait', check: check(HOLD, -14), minutes: 45, span: 'All night',
          summary: 'Command keeps the street closed while {subject.first} sits with it. Your squad stays on this corner for as long as that takes.',
          preview: { favorable: '{subject.first} calls out that {subject.he} {subject~is|are} coming out.', mixed: '{subject.first} comes out at first light.', adverse: '{subject.first} is still inside when your shift ends.' },
          outcomes: {
            favorable: [{ text: '{subject.first} calls out that {subject.he} {subject~is|are} coming out, and {subject~walks|walk} to the team with {subject.his} hands open. The team has {subject.him}.', out: ['subject'], next: { ending: 'out_by_morning' }, objective: 28 }],
            mixed: [{ text: '{subject.first} comes out at first light with {subject.his} hands open. The team has {subject.him}.', out: ['subject'], next: { ending: 'out_by_morning' }, objective: 24, minutes: 30 }],
            adverse: [{ text: '{subject.first} is still in the front room at the end of the shift. Command keeps the street closed.', next: { ending: 'son_out_held' } }],
          } },
      ] },
    { id: 'threat', stage: 'resolve',
      prompt: '{subject.first} is at the bathroom door with the rifle, and {child.first} is behind it.',
      choices: [
        { id: 'call_back', title: 'Call {subject.him} back to the front', icon: 'radio', talksTo: 'subject', check: check(TALK, 8), minutes: 2, stress: 4, consequenceLevel: 'high',
          summary: '{lead} calls {subject.first} from the front step, close enough to be heard through the house. If {subject.he} {subject~turns|turn}, {lead} is the one in front of {subject.him}.',
          preview: { favorable: '{subject.first} steps back from the door, and {child.first} walks out.', mixed: '{child.first} gets out, and {subject.first} keeps the rifle.', adverse: '{subject.first} fires at the front door, and the officer on the step may be hit.' },
          outcomes: {
            favorable: [{ text: '{subject.first} steps back from the bathroom door and answers. {child.first} walks out past the front room and out the door.', safe: ['child'], next: { node: 'son_out' }, objective: 40, pressure: -10 }],
            mixed: [{ text: '{child.first} gets out while {subject.first} shouts at the officer on the step. {subject.first} keeps the rifle in {subject.his} hands.', safe: ['child'], moves: { subject: 'provoked' }, next: { node: 'son_out' }, objective: 32 }],
            adverse: [{ text: '{subject.first} fires at the front door and stays at the bathroom door.', fire: { from: 'subject' }, next: { node: 'fired_on' }, pressure: 10 }],
          } },
        goIn(8),
        { id: 'step_away', title: 'Pull the team out of {subject.his} sight', icon: 'wait', check: check(HOLD, -2), minutes: 8,
          summary: 'Everyone steps back so {subject.first} has no one to aim at. Nobody is close enough to help {child.first} if {subject.first} opens that door.',
          preview: { favorable: '{subject.first} goes back to the front room, and {child.first} walks out.', mixed: '{subject.first} goes back to the front room, and {child.first} stays put.', adverse: '{subject.first} stays at the bathroom door. If {subject.he} {subject~goes|go} in to {child.first}, nobody is close enough to stop {subject.him}.' },
          outcomes: {
            favorable: [{ text: 'With nobody in sight, {subject.first} goes back to the front room. {child.first} walks out a minute later.', safe: ['child'], next: { node: 'son_out' }, objective: 36 }],
            mixed: [{ text: '{subject.first} goes back to the front room. {child.first} stays behind the bathroom door and won’t answer anyone.', next: { ending: 'held_with_son' }, objective: 12 }],
            adverse: [
              { if: { fact: 'comes_out', is: true }, text: '{subject.first} stays at the bathroom door with the rifle. The team waits at the cars, and command keeps the street closed.', reveal: ['comes_out'], next: { ending: 'held_with_son' }, pressure: 8 },
              { if: { fact: 'comes_out', is: false }, text: 'The team hears the bathroom door give. Then {child.first} crawls out to them, hurt by the rifle stock, and {subject.first} shuts {subject.himself} in the bathroom with the rifle.', reveal: ['comes_out'], safe: ['child'], harm: { child: 'serious' }, next: { ending: 'son_beaten' }, objective: 10, pressure: 10 },
            ],
          } },
      ] },
    { id: 'fired_on', stage: 'resolve',
      prompt: '{subject.first} fired through the front door. {child.first} is still in the bathroom.',
      choices: [
        goIn(12),
        { id: 'hold_cars', title: 'Hold at the cars and call {subject.him}', icon: 'wait', talksTo: 'subject', check: check(HOLD), minutes: 10,
          summary: 'The team holds at the cars and regroups. {child.first} stays behind the door with someone who has just fired.',
          preview: { favorable: '{subject.first} backs off, and {child.first} walks out.', mixed: '{subject.first} picks up and stays at the bathroom door.', adverse: '{subject.first} won’t pick up, and stays at the bathroom door.' },
          outcomes: {
            favorable: [{ text: '{subject.first} goes back to the front room, shouting that {subject.he} didn’t mean it. {child.first} walks out a minute later.', safe: ['child'], moves: { subject: 'provoked' }, next: { node: 'son_out' }, objective: 30 }],
            mixed: [{ text: '{subject.first} picks up but stays at the bathroom door with the rifle. Command keeps the street closed.', next: { ending: 'held_with_son' }, objective: 8 }],
            adverse: [{ text: '{subject.first} won’t pick up. {subject.He} {subject~is|are} still at the bathroom door, and command keeps the street closed.', next: { ending: 'held_with_son' }, pressure: 6 }],
          } },
      ] },
  ],
  endings: {
    everyone_out: { title: 'Everyone out', disposition: 'resolved',
      summary: '{child.first} is safe with {child.his} {ex^father|mother|parent} behind the patrol cars. {subject.first} is with the team now, and what happens next is not this call’s to decide. {ex.first} hasn’t let go of {child.first} since {child.he} came out.' },
    out_by_morning: { title: 'Out after a long night', disposition: 'resolved',
      summary: '{child.first} is safe with {child.his} {ex^father|mother|parent}, and neither of them has slept. {subject.first} came out to the team after a long night and is with them now.' },
    son_out_held: { title: 'Alone in the house', disposition: 'relief_partial', remainingTasks: ['Bring {subject.first} out alive'],
      summary: '{child.first} is safe with {child.his} {ex^father|mother|parent}. {subject.first} is still alone in the house with the rifle, and command still holds the street.' },
    held_with_son: { title: 'Still behind the door', disposition: 'relief_partial', remainingTasks: ['Get {child.first} out of the house', 'Bring {subject.first} out alive'],
      summary: 'Command still holds the street. {child.first} is still behind the bathroom door, and {subject.first} is still in the house with the rifle.' },
    entry_clean: { title: 'Out through the hallway', disposition: 'resolved',
      summary: '{child.first} is safe with {child.his} {ex^father|mother|parent}, and {subject.first} is with the team now. The entry goes to review. {ex.first} turns away when they bring {subject.him} past the cars.' },
    entry_subject_hurt: { title: '{subject.first} hurt in the hallway', disposition: 'resolved',
      summary: '{subject.first} is with the medic, hurt when the team took the rifle from {subject.him}. {child.first} is safe with {child.his} {ex^father|mother|parent}. The entry goes to review.' },
    entry_son_hurt: { title: 'Out, but hurt', disposition: 'resolved',
      summary: '{child.first} is with the medic, {child.his} arm cut on the bathroom door glass, and {child.his} {ex^father|mother|parent} is beside {child.him}. {subject.first} is with the team now. The entry goes to review.' },
    son_beaten: { title: '{child.first} was hurt', disposition: 'relief_partial', remainingTasks: ['Bring {subject.first} out alive'],
      summary: '{child.first} is with the medic and {child.his} {ex^father|mother|parent}, hurt. {subject.first} is shut in the bathroom with the rifle, and command still holds the street.' },
    subject_shot: { title: 'Hurt in the hallway', disposition: 'resolved',
      summary: '{subject.first} was hurt when the team used force as {subject.he} turned the rifle on them. The crew took {subject.him} with the medic still working. {child.first} is safe with {child.his} {ex^father|mother|parent}, who has not looked at the house since. The shooting goes to review.' },
    handed_over: { title: 'No step left to take', disposition: 'unresolved', remainingTasks: ['Get everyone out of the house safely'],
      summary: 'Command still holds the street, and the call is still open. The team has no step left that it can take from here.' },
  },
  rewards: { funding: 2400, devPoints: 3, trust: 6, xp: 45 },
  squads: { min: 1, max: 3 },
};
