import type { TreeChoice, TreeIf, TreeOutcome, TreeState, TreeTimeout } from './types';

// The pieces The Room Next Door shares between its stage files (design sheet: docs/calls/warrant-design.md):
// checks, the truths its outcomes read, the states the family can be in, and the choices where an
// officer who knows the man inside changes how it goes.

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const HOLD = { kind: 'contact', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const ASK = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }] } as const;
const LOOK = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const MOVE = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }] } as const;
const ENTER = { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.4 }, { key: 'composure', weight: 0.35 }, { key: 'shooting', weight: 0.25 }] } as const;
export const CHECKS = { TALK, HOLD, ASK, LOOK, MOVE, ENTER };
type Base = typeof TALK | typeof HOLD | typeof ASK | typeof LOOK | typeof MOVE | typeof ENTER;
export const check = (base: Base, difficulty = 0): TreeChoice['check'] =>
  ({ kind: base.kind, ratings: base.ratings.map(rating => ({ ...rating })), difficulty });

// Why the man on the warrant won't open the door. One truth per situation, never printed as a
// narrator's fact: he is buying time to leave by the ladder he stood under the family's window; he
// won't be taken where the child next door can see; he will only walk out where the street can see.
export const LEAVING: TreeIf = { fact: 'leaving', is: true };
export const FOR_KID: TreeIf = { fact: 'for_kid', is: true };
export const SEEN: TreeIf = { fact: 'witnesses', is: true };
/** Not leaving: the two situations where he means to come out the front, on his own terms. */
export const STAYING: TreeIf = { fact: 'leaving', is: false };

/** A crisis negotiator on the call: talk that turns on the words goes better. */
export const NEGOTIATOR = { cert: 'crisis_negotiation', value: 6, label: 'Negotiation training' } as const;
/** A surveillance officer reads a dark window and a back wall. */
export const SURVEILLANCE = { cert: 'surveillance', value: 6, label: 'Surveillance training' } as const;
/** Moving a sleeping family past a door without a sound. */
export const DEESCALATION = { cert: 'deescalation', value: 5, label: 'De-escalation training' } as const;
export const CALM_AT_DOOR = { trait: 'calm_voice' as const, value: 3, label: 'sounds the same through a door at five in the morning' };
export const STEADY_ON_STAIRS = { trait: 'steady' as const, value: 4, label: 'doesn’t hurry on the stairs' };
export const OBSERVANT_AT_BACK = { trait: 'observant' as const, value: 4, label: 'notices what’s out of place at the back' };

/** The family next door: both out together, or both still upstairs. */
export const FAMILY_IN: TreeState = { notSafe: ['parent'] };
export const FAMILY_OUT: TreeState = { safe: ['parent'] };
/** The landing held with the family out (hold_landing), or the back covered (cover_back): either way
 * he can't reach the ladder unseen. One officer talking at his door with the family still asleep
 * next door (name_at_door, `team_close` alone) is not cover: he can still go for their room. */
export const UNCOVERED: TreeState = { notMarks: ['covered'] };
export const COVERED: TreeState = { marks: ['covered'] };

/** The family brought out, both of them. */
export const familyOut = (extra: Partial<TreeOutcome> = {}): Pick<TreeOutcome, 'safe'> & Partial<TreeOutcome> => ({ safe: ['parent', 'kid'], ...extra });

/** Situation 1, where he is leaving: what a walk-out choice meets. With the landing or the back
 * covered he can't reach the ladder unseen; with the family out he goes over the back; with the
 * family still asleep next door his way to the ladder is through their room. */
export function forTheLadder(opts: { covered: TreeOutcome; roof: TreeOutcome; family: TreeOutcome }): TreeOutcome[] {
  return [
    { ...opts.covered, if: LEAVING, when: { ...opts.covered.when, ...COVERED } },
    { ...opts.roof, if: LEAVING, when: { ...opts.roof.when, ...UNCOVERED, ...FAMILY_OUT } },
    { ...opts.family, if: LEAVING, when: { ...opts.family.when, ...UNCOVERED, ...FAMILY_IN } },
  ];
}

/** The call ends with him still in his room: the held ending names whether the family is still
 * next door. `lead` carries the text and effects. */
export const heldEnd = (lead: TreeOutcome, also: TreeIf[] = [], state: TreeState = {}): TreeOutcome[] => {
  const iff = also.length ? { if: also } : {};
  return [
    lead,
    { ...iff, when: { ...state, ...FAMILY_OUT }, text: '', next: { ending: 'held_in' } },
    { ...iff, when: { ...state, ...FAMILY_IN }, text: '', next: { ending: 'held_with_family' } },
  ];
};

/** A moment run out with nobody choosing: command holds the house as it stands. */
export const holdTheHouse = (text: string): TreeTimeout => ({ text, next: { ending: 'held_in' }, nextIf: [{ when: FAMILY_IN, next: { ending: 'held_with_family' } }] });

/** The lie (dilemma pattern 15): the team told him he would sleep at home tonight. At the foot of
 * the stairs the cuffs are waiting in every situation, so any walk down the stairs finds it out. */
export const foundOut = (text: string, extra: Partial<TreeOutcome> = {}): TreeOutcome =>
  ({ when: { marks: ['lied_home'], notMarks: ['owned_lie'] }, breaks: ['home_tonight'], moves: { lt: 'provoked' }, text, ...extra });

/** The choices where an officer who knows the man on the warrant changes how it goes, one per
 * stage, and two in stage 3 because walk_beside needs him talking first (docs/world-redesign.md,
 * "Officers know people"). The text is written for any officer; the
 * world-calls lane reads the tie and adds its capped, visible contributor to these actions only.
 * Action ids follow compile.ts choiceActionId: `t13_barricaded_<node>_<choice>`. */
export const WARRANT_TIE_CHOICES: readonly { node: string; choice: string }[] = [
  { node: 'the_knock', choice: 'name_at_door' },
  { node: 'through_door', choice: 'gym_talk' },
  { node: 'family_out', choice: 'call_gym' },
  { node: 'way_out', choice: 'walk_beside' },
  { node: 'last_door', choice: 'sit_on_stairs' },
];

/** Endings and the investigation (TreeEnding.world): every ending where the team has him closes it
 * as charged; every ending where he is still in the house or gone leaves the lead open. */
export const WARRANT_RESOLUTIONS = { charged: ['walked_out', 'custody_clean', 'custody_hurt', 'family_hurt'], escaped: ['escaped', 'held_in', 'held_with_family', 'in_with_family', 'handed_over'] } as const;
