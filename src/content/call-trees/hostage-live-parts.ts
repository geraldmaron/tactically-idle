import type { TreeChoice, TreeIf, TreeNext, TreeOutcome, TreeState, TreeTimeout } from './types';

// The pieces Going Live's stage files share: checks, the conditions its outcomes read, and the few
// helpers that carry a rule (who stays inside, what a held ending says, what a lie costs).

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const ASK = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
/** Taking something away from the rider to make them talk. The bigger the audience, the harder it is. */
const PRESS = { kind: 'pressure', ratings: [{ key: 'composure', weight: 0.5 }, { key: 'coordination', weight: 0.5 }] } as const;
/** Reading a crowd of strangers for the one who knows: noticing first, then asking the right person. */
const READ = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
export const CHECKS = { TALK, HOLD, ASK, MOVE, PRESS, READ, ENTER };
type Base = typeof TALK | typeof HOLD | typeof ASK | typeof MOVE | typeof PRESS | typeof READ | typeof ENTER;
export const check = (base: Base, difficulty = 0): TreeChoice['check'] =>
  ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

// What the call can ask about the bag. Three situations, three different earlier scenes:
// the clerk took it (rider_clear, no proof); the rider took it (not rider_clear); nobody took it,
// and a viewer holds the proof (rider_clear and proof).
export const CLEAR: TreeIf = { fact: 'rider_clear', is: true };
export const TOOK: TreeIf = { fact: 'rider_clear', is: false };
export const PROOF: TreeIf = { fact: 'proof', is: true };
export const NO_PROOF: TreeIf = { fact: 'proof', is: false };
/** The rider past breaking point (the stance the card shows) is the only way the handgun comes up
 * on an adverse result: every threat has a cause the player could see. */
export const BREAKING: TreeIf = { meter: 'rider', stance: 'breaking' };
export const HOLDING: TreeIf = { meter: 'rider', stance: 'breaking', is: false };

/** A crisis negotiator on the call: talk that turns on the words goes better. */
export const NEGOTIATOR = { cert: 'crisis_negotiation', value: 6, label: 'Negotiation training' } as const;
/** A surveillance officer moves the squad up where the rider won't see it. */
export const SURVEILLANCE = { cert: 'surveillance', value: 6, label: 'Surveillance training' } as const;
/** A steady officer doesn't speed up for the camera (content/traits.ts). */
export const STEADY_ON_CAMERA = { trait: 'steady' as const, value: 4, label: 'doesn’t speed up for the camera' };
export const CALM_ON_CAMERA = { trait: 'calm_voice' as const, value: 3, label: 'sounds the same to two thousand strangers' };
export const OBSERVANT_ON_CHAT = { trait: 'observant' as const, value: 4, label: 'finds the one comment that matters' };

/** An adverse result that provokes the rider. `lead` is said either way, with `extra`. The handgun
 * comes up only when the rider is past breaking point, the stance the card shows, so a player who
 * kept pushing saw it coming. Otherwise `quiet` is what the choice cost, written for that choice. */
export function turnsOn(opts: { lead: string; threat: string; quiet: string; quietNext: TreeNext; extra?: Partial<TreeOutcome> }): TreeOutcome[] {
  const { lead, threat, quiet, quietNext, extra = {} } = opts;
  return [
    { ...extra, text: lead },
    { if: BREAKING, text: threat, mark: ['turned'], next: { node: 'threat' } },
    { if: HOLDING, text: quiet, next: quietNext },
  ];
}

/** The clerk goes out with the manager when still inside. */
export const clerkToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['clerk'] }, text, safe: ['clerk'], ...extra });

/** The manager goes out ahead of the rider when still inside. */
export const managerToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['manager'] }, text, safe: ['manager'], ...extra });

/** The call ends with the manager still inside: the lead line, a line while the clerk is inside, and
 * the ending by who is left. `also` are conditions every row after the lead keeps. */
export const heldEnd = (lead: TreeOutcome, clerkLine: string, also: TreeIf[] = [], state: TreeState = {}): TreeOutcome[] => {
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
export const MANAGER_IN: TreeState = { notSafe: ['manager'] };
/** The stream running, cut by command, or ended by the rider. */
export const ON_STREAM: TreeState = { notMarks: ['cut', 'stream_off'] };
export const STREAM_CUT: TreeState = { marks: ['cut'] };
export const STREAM_ENDED: TreeState = { marks: ['stream_off'], notMarks: ['cut'] };

/** A moment run out with no choice made: command takes the street and holds it, and the held ending
 * names who is still inside. */
export const holdTheNight = (text: string): TreeTimeout => ({ text, next: { ending: 'rider_held' },
  nextIf: [{ when: { notSafe: ['manager', 'clerk'] }, next: { ending: 'held_both' } }, { when: MANAGER_IN, next: { ending: 'held_counter' } }] });

/** The lie (dilemma pattern 15): the team told the rider the clerk backs the rider's story. The clerk
 * has said nothing to anyone, so on any road to the door the rider hears it on the stream, from the
 * clerk's own phone. It is true in no situation. */
export const foundOut = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome =>
  ({ when: { marks: ['lied_clerk'] }, breaks: ['clerk_backs'], mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 12 }, text, ...extra });

