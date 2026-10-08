// A small call with a counted group, for the group gates (groups.test.ts, call-trees.test.ts). Never
// dispatched: the hostage call becomes a group call through the writing skills. The taker leads 0 to
// 3 others; text that names them sits behind count conditions, the taker's surrender cascades, a
// conversation and a shot can come from the group, and a node only a split group reaches.
import type { CallTree, TreeChoice } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';

const TALK = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }] } as const;
const check = (): TreeChoice['check'] => ({ kind: TALK.kind, ratings: TALK.ratings.map(rating => ({ ...rating })) });
const same = (text: string) => ({ favorable: text, mixed: text, adverse: text });

export const GROUP_TREE: CallTree = {
  type: 'hostage_crisis',
  title: 'The Back Counter',
  roles: [
    { id: 'taker', label: 'former employee', pronouns: 'he', kind: 'subject' },
    { id: 'courier', label: 'courier', pronouns: 'he', kind: 'civilian' },
  ],
  groups: { others: { slot: 'subjects', leader: 'taker', label: 'friend of the taker' } },
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 1 },
  summary: '{courier} is still inside {place}, and {taker.first} won’t open the door.',
  pressureLabel: '{courier.first} by the door',
  pressure: { start: 20, perMinute: 0.25, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: 'Patrol heard {taker.first} shouting at {courier.first} through the glass.',
    known: ['{courier.first} is inside with {taker.first}.'],
    unknown: ['Who else is behind the counter'],
    responsibilities: ['Get {courier.first} out'],
  },
  stageLabels: { assess: 'The glass', adapt: 'The counter', resolve: 'The door' },
  objectives: [{ id: 'courier', label: 'Get {courier.first} out' }],
  facts: {
    gives_up: { label: 'Ready to stop', claim: '{taker.first} will walk out if asked.', confirmed: '{taker.first} says {taker.he} will walk out.', disproved: '{taker.first} says {taker.he} won’t leave.' },
  },
  situations: [
    { note: 'ready to stop', truth: { gives_up: true } },
    { note: 'not ready', truth: { gives_up: false } },
    { note: 'ready, friends wavering', truth: { gives_up: true } },
  ],
  root: 'open',
  nodes: [
    {
      id: 'open', stage: 'assess', prompt: '{taker.first} is at the counter with {courier.first}.',
      promptIf: [
        { when: { count: { role: 'others', min: 2 } }, prompt: '{taker.first} is at the counter. {others} stand by the till.' },
        { when: { count: { role: 'others', min: 1, max: 1 } }, prompt: '{taker.first} is at the counter. {others.first} stands by the till, and {others.he} {others~keeps|keep} looking at the door.' },
      ],
      choices: [
        { id: 'call', title: 'Call the shop phone', summary: '{lead} calls the shop phone while {courier.first} waits.', preview: same('{taker.first} picks up.'), icon: 'radio', check: check(), minutes: 4,
          outcomes: {
            favorable: [{ text: '{taker.first} picks up and talks.', next: { node: 'talk' }, moves: { taker: 'contact' } },
              { when: { count: { role: 'others', min: 1 } }, text: '{others} {others#listens|listen} from the till.', moves: { others: 'contact' } }],
            mixed: [{ text: '{taker.first} picks up and hangs up.', next: { node: 'talk' } }],
            adverse: [{ text: '{taker.first} lets the phone ring out.', next: { node: 'talk' } }],
          } },
        { id: 'watch', title: 'Watch from the glass', summary: 'You watch the counter while {courier.first} waits.', preview: same('You see the counter.'), icon: 'search', check: check(), minutes: 3,
          outcomes: {
            favorable: [{ text: 'The team counts who is behind the counter.', next: { node: 'talk' } }],
            mixed: [{ text: 'The team sees the counter and little past it.', next: { node: 'talk' } }],
            adverse: [{ text: 'The blinds come down.', next: { node: 'talk' } }],
          } },
      ],
    },
    {
      id: 'talk', stage: 'adapt', prompt: '{taker.first} is on the line.',
      choices: [
        { id: 'ask_out', title: 'Ask everyone to walk out', summary: '{lead} asks {taker.first} to walk out first.', preview: same('{taker.first} decides.'), icon: 'door', check: check(), minutes: 5,
          outcomes: {
            favorable: [{ text: '{taker.first} puts the bag on the counter and walks out to the team.', out: ['taker'], safe: ['courier'],
              cascade: { leader: 'taker', group: 'others', next: { all: { ending: 'all_out' }, some: { node: 'last' }, none: { node: 'last' } } } }],
            mixed: [{ text: '{taker.first} walks out slowly, with {courier.first} ahead.', out: ['taker'], safe: ['courier'],
              cascade: { leader: 'taker', group: 'others', next: { all: { ending: 'all_out' }, some: { node: 'last' }, none: { node: 'last' } } } }],
            adverse: [{ text: '{taker.first} says no and hangs up.', next: { node: 'final' } }],
          } },
        { id: 'hold', title: 'Hold at the glass', summary: 'You hold while {courier.first} waits by the door.', preview: same('The counter stays quiet.'), icon: 'wait', check: check(), minutes: 6,
          outcomes: {
            favorable: [{ text: 'The counter stays quiet.', next: { node: 'final' } }],
            mixed: [{ text: 'Someone moves behind the counter.', next: { node: 'final' } }],
            adverse: [{ text: 'A shot hits the glass by the door.', next: { node: 'final' } },
              { when: { count: { role: 'others', min: 1 } }, text: '{others.first} is the one by the door.', fire: { from: 'others' } }],
          } },
        { id: 'talk_others', title: 'Talk to the one by the till', summary: '{lead} talks to {others.first} while {taker.first} listens.', preview: same('{others.first} answers.'), icon: 'radio', check: check(), minutes: 4,
          talksTo: 'others', onlyIf: { count: { role: 'others', min: 1 } },
          outcomes: {
            favorable: [{ text: '{others.first} says {others.he} only came in for {taker.first}.', next: { node: 'last' }, moves: { others: 'heard' } }],
            mixed: [{ text: '{others.first} answers and stops.', next: { node: 'last' } }],
            adverse: [{ text: '{others.first} won’t answer.', next: { node: 'last' }, moves: { others: 'provoked' } }],
          } },
      ],
    },
    {
      id: 'final', stage: 'resolve', prompt: '{courier.first} is by the door.',
      choices: [
        { id: 'end_talk', title: 'Talk everyone out', summary: '{lead} keeps talking until the door opens.', preview: same('The door opens.'), icon: 'radio', check: check(), minutes: 8,
          outcomes: {
            favorable: [{ text: 'Everyone walks out to the team.', out: ['taker', 'others'], safe: ['courier'], next: { ending: 'all_out' } }],
            mixed: [{ text: 'Everyone walks out, {courier.first} last.', out: ['taker', 'others'], safe: ['courier'], next: { ending: 'all_out' } }],
            adverse: [{ text: 'Nobody comes out.', next: { ending: 'handed_over' } }],
          } },
        { id: 'leave', title: 'Hand the scene over', summary: 'You hand over while {courier.first} is still inside.', preview: same('The next shift takes over.'), icon: 'handover', check: check(), minutes: 2,
          outcomes: { favorable: [{ text: 'The next shift takes the glass.', next: { ending: 'handed_over' } }], mixed: [{ text: 'The next shift takes the glass.', next: { ending: 'handed_over' } }], adverse: [{ text: 'The next shift takes the glass.', next: { ending: 'handed_over' } }] } },
      ],
    },
    {
      id: 'last', stage: 'resolve', prompt: '{others} {others#is|are} still behind the counter. {others.He} {others~has|have} the {others.room} blinds half down.',
      choices: [
        { id: 'call_back', title: 'Call the rest out', summary: '{lead} calls {others.first} by name.', preview: same('{others.first} hears {others.his} name.'), icon: 'radio', check: check(), minutes: 5, talksTo: 'others',
          outcomes: {
            favorable: [{ text: '{others} {others#comes|come} out.', out: ['others'], next: { ending: 'all_out' } }],
            mixed: [{ text: '{others} {others#comes|come} out slowly.', out: ['others'], next: { ending: 'all_out' } }],
            adverse: [{ text: '{others} {others#stays|stay} put.', next: { ending: 'some_left' } }],
          } },
        { id: 'hand_over', title: 'Hand the rest over', summary: 'You hand over with {others.first} inside.', preview: same('The next shift takes over.'), icon: 'handover', check: check(), minutes: 2,
          outcomes: { favorable: [{ text: 'The next shift takes the door.', next: { ending: 'some_left' } }], mixed: [{ text: 'The next shift takes the door.', next: { ending: 'some_left' } }], adverse: [{ text: 'The next shift takes the door.', next: { ending: 'some_left' } }] } },
      ],
    },
  ],
  endings: {
    all_out: { title: 'Everyone out', summary: '{courier.first} is out, and so is {taker.first}.', disposition: 'resolved' },
    some_left: { title: 'Still inside', summary: '{others} {others#is|are} still inside with the next shift at the door.', disposition: 'unresolved' },
    handed_over: { title: 'Handed over', summary: 'The next shift has the glass.', disposition: 'unresolved' },
  },
  rewards: { funding: 2000, devPoints: 2, trust: 4, xp: 30 },
  squads: { min: 1, max: 3 },
};

/** The taker and 0 to 3 others, each drawn into the group; in the third situation the others are
 * held loosely. */
export const GROUP_TEMPLATE: IncidentTemplate = {
  type: 'hostage_crisis',
  label: 'Group fixture',
  tree: GROUP_TREE,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 4 }, keyRoles: ['taker'], person: {
      label: 'subject', age: 'adult', activity: 'holding',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'brandished' },
      weapons: [{ kind: 'handgun', real: 'real', where: 'in_hand', visible: true }],
      proficiency: 'some', noDeathOnCard: true,
      meters: { agitation: 60, rapport: 10 },
      group: { role: { pick: [['follower', 70], ['lookout', 30]] }, influence: { min: 0.4, max: 0.9 } },
    } },
    { id: 'hostages', kind: 'hostage', count: { min: 1, max: 1 }, keyRoles: ['courier'], person: {
      label: 'courier', age: 'adult', hold: { by: 'taker', kind: 'incidental', restraint: 'watched', relationship: 'stranger' },
    } },
  ],
  conditions: { timeOfDay: 'day', power: 'on', weather: 'clear', crowd: 1 },
  situations: [{ index: 0 }, { index: 1 }, { index: 2, people: { others: { group: { role: 'follower', influence: { min: 0.05, max: 0.15 } } } } }],
  complications: [],
};
