import type { TreeChoice, TreeIf, TreeNext, TreeOutcome, TreeState, TreeTimeout } from './types';

// The pieces Going Live's stage files share: checks, the conditions its outcomes read, and the few
// helpers that carry a rule (who stays inside, what a refusal costs, what a lie costs).

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
export const CALM_ON_CAMERA = { trait: 'calm_voice' as const, value: 3, label: 'sounds the same to every viewer' };
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

/** The clerk comes out of the stockroom and leaves with the manager when still inside. */
export const clerkToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['clerk'] }, text, safe: ['clerk'], ...extra });

/** The manager goes out ahead of the rider when still inside. */
export const managerToo = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome => ({ when: { notSafe: ['manager'] }, text, safe: ['manager'], ...extra });

/** What the team does when the rider will not leave (owner, 2026-10-24: no call ends with the subject
 * left inside, and a refusal is never a result by itself). `lead` says what the rider did, a line says
 * where the clerk is while the clerk is inside, and `entry` is the one row that orders the door, written
 * for the choice it follows (an effect text belongs to one action). It brings the manager and the clerk
 * out and takes the rider, and a drawn use of the team's hands decides whether the rider is hurt
 * (`rider_hurt`) or not (`entry_clean`). The text names nobody who may already be out, so one row serves
 * every state. `also` and `state` are conditions the rows after the lead keep. */
export const forcedEntry = (lead: TreeOutcome, clerkLine: string, entry: string, also: TreeIf[] = [], state: TreeState = {}): TreeOutcome[] => [lead, ...afterRefusal(clerkLine, entry, also, state)];

/** The rows after a refusal's lead, for an outcome that writes its own lead rows (one per stream state). */
export const afterRefusal = (clerkLine: string, entry: string, also: TreeIf[] = [], state: TreeState = {}): TreeOutcome[] => {
  const iff = also.length ? { if: also } : {};
  const clerkIn: TreeState = { ...state, notSafe: [...state.notSafe ?? [], 'clerk'] };
  return [
    { ...iff, when: clerkIn, text: clerkLine },
    { ...iff, ...(Object.keys(state).length ? { when: state } : {}), text: entry, safe: ['manager', 'clerk'], out: ['rider'],
      force: { on: 'rider', next: { hurt: { ending: 'rider_hurt' }, none: { ending: 'entry_clean' } }, noFatal: true }, objective: 20 },
  ];
};

export const MANAGER_IN: TreeState = { notSafe: ['manager'] };
/** The stream running, or down: cut by command (`cut`) or ended by the rider (`stream_off`). Both set
 * `stream_down`, so a line that only needs "no live picture" reads one mark. */
export const ON_STREAM: TreeState = { notMarks: ['stream_down'] };
export const STREAM_DOWN: TreeState = { marks: ['stream_down'] };
export const STREAM_CUT: TreeState = { marks: ['cut'] };
export const STREAM_ENDED: TreeState = { marks: ['stream_off'], notMarks: ['cut'] };

/** A moment run out with no choice made: command takes the front door at its own hour. Nobody chose,
 * so nothing is drawn: with the manager still inside the manager is hurt on the way out
 * (`entry_hurt`), and otherwise the team has the rider and nobody is hurt (`door_taken`). The text
 * names neither, because it reads before either. */
export const commandTakesDoor = (text: string): TreeTimeout => ({
  text, next: { ending: 'door_taken' }, safe: ['manager', 'clerk'], out: ['rider'],
  nextIf: [{ when: MANAGER_IN, next: { ending: 'entry_hurt' }, safe: ['manager', 'clerk'], out: ['rider'], harm: { manager: 'wounded' } }],
});

/** The lie (dilemma pattern 15): the team told the rider the clerk backs the rider's story. The clerk
 * has said nothing to anyone, and it is true in no situation. `lied_clerk` is the lie told. It
 * settles once, by discovery (`lie_found`) or by the team taking it back (`lie_owned`, own_lie), and
 * both set `lie_settled`. The engine keeps a promise when its person walks out (sim/commitments.ts),
 * so every outcome that brings the rider out while the lie is open carries this discovery: a lie is
 * never kept. */
export const LIE_OPEN: TreeState = { marks: ['lied_clerk'], notMarks: ['lie_settled'] };
export const foundOut = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome =>
  ({ when: LIE_OPEN, breaks: ['clerk_backs'], mark: ['lie_found', 'lie_settled'], moves: { rider: 'provoked' }, text, ...extra });

/** A walk-out ends `out_cleared` only when the viewers heard where the order went: the matched porch
 * clip, or the manager naming the clerk on the stream. Otherwise it is `out_on_camera`, whatever the
 * hidden truth. The text and its effects come first, with no `next`; these rows route it. */
export const walkOutEnding = (other: string = 'out_on_camera'): TreeOutcome[] => [
  { when: { marks: ['proof_seen'] }, text: '', next: { ending: 'out_cleared' } },
  { when: { marks: ['admitted_live'], notMarks: ['proof_seen'] }, text: '', next: { ending: 'out_cleared' } },
  { when: { notMarks: ['proof_seen', 'admitted_live'] }, text: '', next: { ending: other } },
];
