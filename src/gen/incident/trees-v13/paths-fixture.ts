// A call the path-measure tests own (COORDINATION.md, "Tests across lanes"): small enough to read, and
// built twice from one builder. With `defects` it fails every path measure on purpose; without, it is
// the control that passes each. Never shipped. Built on the group fixture's cast and building rules
// (group-fixture.ts) so it compiles on a generated building like any call; its nodes are its own.
//   open (assess) -> middle (adapt, a loop through `trap` when defective) -> late (resolve) -> ending
// Defects, one per measure:
//   adverse routes   every bad result in the middle sends the call to `trap`, which sends it back
//   fact reach       the only choices that settle the hidden fact are the hardest at each stage
//   dominance        `slow` is `easy` with more minutes and nothing in exchange
//   echoes           the line at the bottom of `open.easy` is the line at the bottom of `late`
import type { CallTree, TreeChoice, TreeOutcome } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { OutcomeBand } from '../../../sim/types';
import { GROUP_TEMPLATE, GROUP_TREE } from './group-fixture';

export const PATHS_FIXTURE = { fact: 'f_gives_up', trap: 'trap', slow: 'slow', easy: 'easy', root: 'open', echo: 'the line goes dead and the shop stays quiet' } as const;

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;

interface Spec { id: string; title: string; minutes: number; difficulty?: number; reveal?: boolean; mark?: boolean; next: Record<OutcomeBand, TreeOutcome['next']>; text: Record<OutcomeBand, string>; end?: boolean }

function choice(spec: Spec): TreeChoice {
  const outcomes = Object.fromEntries(BANDS.map(band => [band, [{
    text: spec.text[band], next: spec.next[band], ...spec.reveal && band !== 'adverse' ? { reveal: ['gives_up'] } : {}, ...spec.mark && band !== 'adverse' ? { mark: ['asked'] } : {},
    ...spec.end && band !== 'adverse' ? { out: ['taker'], safe: ['courier'] } : {},
  }]])) as TreeChoice['outcomes'];
  return {
    id: spec.id, title: spec.title, summary: `${spec.title}. ${spec.minutes} minutes.`, icon: 'radio', minutes: spec.minutes,
    preview: { favorable: 'It goes well.', mixed: 'It goes halfway.', adverse: 'It goes badly.' },
    check: { kind: TALK.kind, ratings: TALK.ratings.map(rating => ({ ...rating })), difficulty: spec.difficulty ?? 0 }, outcomes,
  };
}

const to = (node: string) => ({ node }), finish = (ending: string) => ({ ending });
const all = <T>(value: T): Record<OutcomeBand, T> => ({ favorable: value, mixed: value, adverse: value });

export function pathsFixture(defects: boolean): IncidentTemplate {
  const adverseMiddle = defects ? to(PATHS_FIXTURE.trap) : to('late');
  const open: TreeChoice[] = defects ? [
    choice({ id: 'easy', title: 'Call the shop phone', minutes: 4, difficulty: -25, next: { favorable: to('middle'), mixed: to('middle'), adverse: to('middle') },
      text: { favorable: '{taker.first} picks up and listens to the offer.', mixed: '{taker.first} picks up and hangs up again.', adverse: `${PATHS_FIXTURE.echo}.`.replace(/^./, c => c.toUpperCase()) } }),
    choice({ id: 'slow', title: 'Call the shop phone and wait', minutes: 8, difficulty: -25, next: { favorable: to('middle'), mixed: to('middle'), adverse: to('middle') },
      text: { favorable: '{taker.first} picks up and listens to the offer.', mixed: '{taker.first} picks up and hangs up again.', adverse: `${PATHS_FIXTURE.echo}.`.replace(/^./, c => c.toUpperCase()) } }),
    choice({ id: 'ask', title: 'Ask the taker straight', minutes: 6, difficulty: 30, reveal: true, next: { favorable: to('middle'), mixed: to('middle'), adverse: to('middle') },
      text: { favorable: '{taker.first} says {taker.he} will walk out.', mixed: '{taker.first} answers and then goes quiet.', adverse: '{taker.first} shouts and slams the till.' } }),
  ] : [
    choice({ id: 'easy', title: 'Call the shop phone', minutes: 4, reveal: true, next: { favorable: to('middle'), mixed: to('middle'), adverse: to('middle') },
      text: { favorable: '{taker.first} picks up and listens to the offer.', mixed: '{taker.first} picks up and hangs up again.', adverse: 'The phone rings out on the counter.' } }),
    choice({ id: 'ask', title: 'Ask the taker straight', minutes: 6, reveal: true, mark: true, next: { favorable: to('middle'), mixed: to('middle'), adverse: to('middle') },
      text: { favorable: '{taker.first} says {taker.he} will walk out.', mixed: '{taker.first} answers and then goes quiet.', adverse: '{taker.first} shouts and slams the till.' } }),
  ];
  const middle: TreeChoice[] = defects ? [
    choice({ id: 'easy', title: 'Keep the line open', minutes: 4, difficulty: -25, next: { favorable: to('late'), mixed: to('late'), adverse: adverseMiddle },
      text: { favorable: 'The team keeps the line open for {taker.first}.', mixed: 'The line stays open, thin.', adverse: '{taker.first} cuts the call short.' } }),
    choice({ id: 'ask', title: 'Press for an answer', minutes: 6, difficulty: 30, reveal: true, next: { favorable: to('late'), mixed: to('late'), adverse: adverseMiddle },
      text: { favorable: '{taker.first} gives a straight answer.', mixed: '{taker.first} answers half of it.', adverse: '{taker.first} stops talking altogether.' } }),
    choice({ id: 'press', title: 'Hold the line and wait', minutes: 5, difficulty: -25, next: { favorable: to('late'), mixed: to('late'), adverse: adverseMiddle },
      text: { favorable: 'The team lets {taker.first} think.', mixed: '{taker.first} thinks and says little.', adverse: '{taker.first} turns away from the phone.' } }),
  ] : [
    choice({ id: 'easy', title: 'Keep the line open', minutes: 4, reveal: true, next: { favorable: to('late'), mixed: to('late'), adverse: adverseMiddle },
      text: { favorable: 'The team keeps the line open for {taker.first}.', mixed: 'The line stays open, thin.', adverse: '{taker.first} cuts the call short.' } }),
    choice({ id: 'ask', title: 'Press for an answer', minutes: 6, reveal: true, mark: true, next: { favorable: to('late'), mixed: to('late'), adverse: adverseMiddle },
      text: { favorable: '{taker.first} gives a straight answer.', mixed: '{taker.first} answers half of it.', adverse: '{taker.first} stops talking altogether.' } }),
  ];
  const trap: TreeChoice[] = [
    ...['one', 'two', 'three'].map(id => choice({ id, title: `Reset the call (${id})`, minutes: 3, next: all(to('middle')), text: all(`The team resets, ${id} more time.`) })),
  ];
  const late: TreeChoice[] = defects ? [
    choice({ id: 'easy', title: 'Ask everyone out', minutes: 5, difficulty: -25, end: true, next: { favorable: finish('done'), mixed: finish('done'), adverse: finish('left') },
      text: { favorable: '{taker.first} walks out with the bag.', mixed: '{taker.first} walks out last.', adverse: `${PATHS_FIXTURE.echo}.`.replace(/^./, c => c.toUpperCase()) } }),
    choice({ id: 'ask', title: 'Ask for the bag', minutes: 7, difficulty: 30, reveal: true, end: true, next: { favorable: finish('done'), mixed: finish('done'), adverse: finish('left') },
      text: { favorable: '{taker.first} hands over the bag.', mixed: '{taker.first} hands over half of it.', adverse: '{taker.first} holds on to the bag.' } }),
  ] : [
    choice({ id: 'easy', title: 'Ask everyone out', minutes: 5, reveal: true, end: true, next: { favorable: finish('done'), mixed: finish('done'), adverse: finish('left') },
      text: { favorable: '{taker.first} walks out with the bag.', mixed: '{taker.first} walks out last.', adverse: 'The door stays shut until the shift ends.' } }),
    choice({ id: 'ask', title: 'Ask for the bag', minutes: 7, reveal: true, mark: true, end: true, next: { favorable: finish('done'), mixed: finish('done'), adverse: finish('left') },
      text: { favorable: '{taker.first} hands over the bag.', mixed: '{taker.first} hands over half of it.', adverse: '{taker.first} holds on to the bag.' } }),
  ];
  const tree: CallTree = {
    ...structuredClone(GROUP_TREE),
    root: 'open',
    nodes: [
      { id: 'open', stage: 'assess', prompt: '{taker.first} is at the counter with {courier.first}.', choices: open },
      { id: 'middle', stage: 'adapt', prompt: '{taker.first} is on the line and {courier.first} waits by the door.', choices: middle },
      ...defects ? [{ id: PATHS_FIXTURE.trap, stage: 'adapt' as const, prompt: 'The call drops and the team starts over.', choices: trap }] : [],
      { id: 'late', stage: 'resolve', prompt: '{courier.first} is by the door and the street is quiet.', choices: late,
        ...defects ? {} : { promptIf: [{ when: { marks: ['asked'] }, prompt: '{courier.first} is by the door and {taker.first} has said what {taker.he} wants.' }] } },
    ],
    endings: {
      done: { title: 'Everyone out', summary: '{courier.first} is out, and so is {taker.first}.', disposition: 'resolved' },
      left: { title: 'Still inside', summary: 'The next shift has the door.', disposition: 'unresolved' },
      handed_over: { title: 'Handed over', summary: 'The next shift has the glass.', disposition: 'unresolved' },
    },
  };
  return { ...GROUP_TEMPLATE, tree };
}
