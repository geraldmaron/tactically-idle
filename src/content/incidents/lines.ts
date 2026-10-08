// The standard lines for drawn consequences (sim/drawn-effects.ts). A call's own result says what led
// up to it ("The shooter fires twice at the doorway."); one of these says what happened, because the
// engine, not the author, settles who was hit and how badly. `{P}` is the person the line is about;
// the compiler rewrites it to their role. Plain and non-graphic: a death is one sentence, the
// person's state first (swat-call-prose, ethics E2.2). Officers are hurt here, never killed.

export const FIRE_LINES = {
  none: 'The shots go wide, and nobody on the team is hit.',
  wounded: 'An officer is hit in the arm and pulled back to cover.',
  serious: 'An officer is hit and goes down, and the team drags the officer back to the medic.',
} as const;

// What a group does when its leader gives up (sim/drawn-effects.ts CASCADE_V1), said after the
// call's own line about the leader, which should leave the leader out with the team. `{P}` is the
// leader; `{names}` is the compiler's list of the members who did it, by first name ("Sol", "Sol
// and Ines"). One name takes `one`, two or more take `many`. A member who was already out takes no
// part and isn't named.
export const CASCADE_LINES = {
  follows: { one: '{names} comes out to the team after {P.first}.', many: '{names} come out to the team after {P.first}.' },
  stays: { one: '{names} stays inside.', many: '{names} stay inside.' },
} as const;

/** Words as a plain list: "Sol", "Sol and Ines", "Sol, Ines and Rae". */
export const listOf = (words: readonly string[]) => words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
/** A count in words for prose ({others.n}), digits past twelve. */
export const countWord = (n: number) => ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);

export const FORCE_LINES = {
  firearm: {
    none: 'An officer fires and misses, and the team has {P.first} on the floor a second later.',
    wounded: '{P.first} is hit when an officer fires once, and the medic is on {P.him}.',
    serious: '{P.first} is badly hurt when two officers fire, and the medic is working on {P.him}.',
    fatal: '{P.first} is killed when two officers fire.',
  },
  less_lethal_device: {
    none: 'The conducted-energy device misses, and the team takes {P.first} to the floor by hand.',
    wounded: '{P.first} drops when an officer uses the conducted-energy device, and the team has {P.him}.',
    serious: '{P.first} falls hard when an officer uses the conducted-energy device, and is badly hurt.',
    fatal: '{P.first} collapses and dies after an officer uses the conducted-energy device.',
  },
  less_lethal_impact: {
    none: 'The impact round misses, and the team has {P.first} on the floor a moment later.',
    wounded: '{P.first} goes down when an officer fires the impact launcher, and the team has {P.him}.',
    serious: '{P.first} goes down badly hurt when an officer fires the impact launcher.',
    fatal: '{P.first} dies after an officer fires the impact launcher.',
  },
  /** The team takes the person by hand. Never fatal (FORCE_RISK_V1.hands). */
  hands: {
    none: 'Two officers get hold of {P.first}, and nobody is hurt.',
    wounded: '{P.first} is hurt as two officers wrestle {P.him} to the floor.',
    serious: '{P.first} hits the floor hard under two officers, and the medic finds {P.him} badly hurt.',
  },
} as const;

// Why the team used the force it did (sim/drawn-effects.ts teamForceProfile), for the debrief. The
// engine fills these at commit from the call's bound labels, never from pronouns: `{person}` is the
// person force was used on, `{near}` the person or the team within reach, `{cover}` the furniture.
// A reason is one threat sentence, then for anything short of deadly force one tool sentence.
export const FORCE_REASONS = {
  /** Deadly force: an imminent threat to life an officer can see (AUTHORIZATION_V1.deadlyForce). */
  deadly: {
    gun: '{person} is holding {weapon}.',
    reach: '{person} has a weapon in hand, a few steps from {near}.',
  },
  /** Why it wasn't deadly force. */
  threat: {
    unseen: 'The team hasn’t seen {person} with a weapon.',
    out_of_reach: '{person} is holding a weapon, but nobody is within reach.',
    unclear: 'Nobody can make out what {person} has in hand.',
    empty: '{person} has nothing in hand.',
  },
  /** Which tool, or why none. */
  tool: {
    less_lethal_impact: 'The impact launcher reaches from the door.',
    less_lethal_device: 'The team is close enough for the conducted-energy device.',
    cover: 'The {cover} is in the way of the less-lethal tools.',
    bystander: '{near} is standing too close for a less-lethal tool.',
    none_carried: 'The team has no less-lethal tool it can use.',
    out_of_range: 'The team’s less-lethal tools don’t reach that far from the door.',
  },
  /** `{near}` when the person within reach is the team at the door. */
  theTeam: 'the team',
} as const;

// What command says about a choice that asks it for something (sim/authorization.ts). An approval
// sits under the choice's summary on the card. A refusal locks the choice and stands in for its
// summary, so it fits the locked budget (80 characters). `{because}` is the call's own bound phrase:
// a threat to life the team has seen, or a clock that won't wait ("Ana can’t wait any longer").
export const COMMAND_LINES = {
  entry: {
    approved: 'Command approves it because {because}.',
    refused: 'Command won’t approve it until someone sees a threat to life.',
  },
  /** One line per kind of concession: the allowed kinds approve, the others refuse. */
  concession: {
    food: 'Command approves sending in food.',
    water: 'Command approves sending in water.',
    phone: 'Command approves passing a phone in.',
    statement: 'Command approves a written statement.',
    message: 'Command approves passing on a message.',
    third_party: 'Command approves someone outside the family talking on the phone.',
    surrender_terms: 'Command approves agreeing on how the surrender goes.',
    weapon: 'Command won’t let a weapon go in.',
    transport: 'Command won’t give anyone a car or a ride out.',
    officer_swap: 'Command won’t trade an officer for anyone inside.',
    family: 'Command won’t put family on the line.',
  },
} as const;

/** A line about person `{P}`, rewritten for a role ('shooter'): `{P.first}` becomes `{shooter.first}`. */
export const asRole = (line: string, role: string) => line.replace(/\{P(?=[.~^}])/g, `{${role}`);
