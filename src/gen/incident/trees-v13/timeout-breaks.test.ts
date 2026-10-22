// A threat that runs out while a commitment stands (backlog: timeout-breaks-commitment): the
// timeout's `breaks` finds the lie out, and without it the lie stays open. Played on a fixture tree
// this file owns, through the engine's lapse, never on live content.
import { describe, expect, it } from 'vitest';
import { GROUP_TEMPLATE, GROUP_TREE } from './group-fixture';
import { generateIncident } from '../index';
import { compileIncident, drawInstance, hostedSpec } from '../instance';
import { choiceActionId, deceptionErrors } from './compile';
import { buildLocation } from '../../../sim/location';
import { METERS_V1 } from '../../../sim/meters';
import { traceRun } from '../../../sim/operation';
import { getScenario } from '../../../sim/scenario-registry';
import { applyMove, lapseMove, startGateRun, withDraftScenario } from '../gates/engine-driver';
import { isLapse } from '../../../sim/types';
import type { CallTree, TreeChoice, TreeTimeout } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import type { GameState, OperationRun } from '../../../sim/types';

const same = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const LIE: TreeChoice = {
  id: 'lie', title: 'Tell him the courier can sign', summary: 'Command can’t promise that. {taker.first} may let {courier.first} go now, and ask for the page later.',
  preview: same('{taker.first} believes you, for now.'), icon: 'radio', check: { kind: 'contact', ratings: [{ key: 'communication', weight: 1 }] }, minutes: 2, deceives: true,
  outcomes: {
    favorable: [{ text: '{taker.first} says {courier.first} can go once the page is signed.', promise: { id: 'signs', to: 'taker', kind: 'lie' }, next: { node: 'final' } }],
    mixed: [{ text: '{taker.first} wants to hear it from {courier.first}.', promise: { id: 'signs', to: 'taker', kind: 'lie' }, next: { node: 'final' } }],
    adverse: [{ text: '{taker.first} doesn’t believe a word.', next: { node: 'final' } }],
  },
};
const FOUND = '{taker.first} asks to see the signed page, and there is none.';

/** The group fixture with a lie at `talk`, and at `final` a threat whose run-out ends the call. The
 * lie is also found out by a choice at `final` unless `onlyTimeout` leaves the run-out as its one
 * route that could. */
function treeWith(timeout: Partial<TreeTimeout>, onlyTimeout = false): CallTree {
  return { ...GROUP_TREE, nodes: GROUP_TREE.nodes.map(node => {
    if (node.id === 'talk') return { ...node, choices: [...node.choices, LIE] };
    if (node.id !== 'final') return node;
    return { ...node,
      threat: { label: '{taker.first} stops waiting', minutes: 9, text: '{taker.first} puts the phone down on the counter.', pressure: 4,
        timeout: { text: FOUND, next: { ending: 'handed_over' }, ...timeout } },
      choices: onlyTimeout ? node.choices : node.choices.map(choice => choice.id !== 'end_talk' ? choice : { ...choice, outcomes: { ...choice.outcomes,
        adverse: [{ text: FOUND, breaks: ['signs'], next: { ending: 'handed_over' } }] } }) };
  }) };
}

function compile(tree: CallTree): ScenarioDefinition {
  const template: IncidentTemplate = { ...GROUP_TEMPLATE, tree };
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _clocks, incidentPeople: _people, threats: _threats, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      drawInstance(template, built, spec);
      return compileIncident({ ...base, id: `timeout-breaks-${seed}`, incident: spec }, built, template);
    } catch (error) { if (error instanceof Error && /lie|breaks|timeout/.test(error.message)) throw error; }
  }
  throw new Error('No seed compiles the fixture');
}

/** The replay's end state; it carries the commitments and meters the type of `end` leaves out. */
const replayed = (scenarioId: string, run: OperationRun) => traceRun(getScenario(scenarioId)!, run).end as Pick<OperationRun, 'commitments' | 'meters'>;
const id = (node: string, choice: string) => choiceActionId('hostage_crisis', node, choice);

/** The run at `final` with the lie told and standing, then the threat there run out. */
function lieThenLapse(scenarioId: string): { standing: GameState; lapsed: GameState } {
  let state = startGateRun(scenarioId);
  for (const actionId of [id('open', 'call'), id('talk', 'lie')]) {
    const next = applyMove(state, { kind: 'decide', actionId, band: 'favorable' });
    expect(next, actionId).not.toBeNull();
    state = next!;
  }
  const move = lapseMove(state);
  expect(move, 'the threat at final has a timeout').not.toBeNull();
  const lapsed = applyMove(state, move!);
  expect(lapsed, 'the lapse commits').not.toBeNull();
  return { standing: state, lapsed: lapsed! };
}

describe('a threat that runs out with a lie standing', () => {
  it('breaks the commitment its timeout names, moves the person’s meters and replays the same', () => {
    const scenario = compile(treeWith({ breaks: ['signs'] }));
    withDraftScenario(scenario, scenarioId => {
      const { standing, lapsed } = lieThenLapse(scenarioId);
      const before = standing.activeRun!;
      expect(before.commitments?.signs, 'the lie is open at the run-out').toMatchObject({ kind: 'lie', status: 'open' });
      const run = lapsed.activeRun!;
      expect(isLapse(run.history.at(-1))).toBe(true);
      expect(run.commitments?.signs).toMatchObject({ kind: 'lie', status: 'broken', madeAt: before.commitments!.signs.madeAt });
      const meters = run.meters!.taker, was = before.meters!.taker;
      expect(meters.agitation).toBeGreaterThan(was.agitation);
      expect(meters.rapport).toBeLessThan(was.rapport);
      expect(meters.moved.promise_broken, 'the break is on the person’s meters').toBeDefined();
      expect(METERS_V1.events.promise_broken.agitation).toBeGreaterThan(0);
      // The replay (the log, the debrief) reads the same state the engine committed.
      expect(replayed(scenarioId, run).commitments?.signs.status).toBe('broken');
      expect(replayed(scenarioId, run).meters!.taker.agitation).toBe(meters.agitation);
    });
  });

  it('leaves the lie standing when the timeout names nothing (control)', () => {
    const scenario = compile(treeWith({}));
    withDraftScenario(scenario, scenarioId => {
      const { lapsed } = lieThenLapse(scenarioId);
      const run = lapsed.activeRun!;
      expect(isLapse(run.history.at(-1))).toBe(true);
      expect(run.commitments?.signs.status, 'a run-out alone does not tell the person').toBe('open');
      expect(run.meters!.taker.moved.promise_broken).toBeUndefined();
      expect(replayed(scenarioId, run).commitments?.signs.status).toBe('open');
    });
  });

  it('does nothing when the commitment was never made', () => {
    const scenario = compile(treeWith({ breaks: ['signs'] }));
    withDraftScenario(scenario, scenarioId => {
      let state = startGateRun(scenarioId);
      state = applyMove(state, { kind: 'decide', actionId: id('open', 'call'), band: 'favorable' })!;
      state = applyMove(state, { kind: 'decide', actionId: id('talk', 'hold'), band: 'favorable' })!;
      const lapsed = applyMove(state, lapseMove(state)!)!;
      expect(lapsed.activeRun!.commitments?.signs).toBeUndefined();
      expect(lapsed.activeRun!.meters!.taker.moved.promise_broken).toBeUndefined();
    });
  });
});

describe('the static check on a timeout that breaks a commitment', () => {
  it('passes beside an outcome that also finds the lie out', () => {
    expect(deceptionErrors(treeWith({ breaks: ['signs'] }))).toEqual([]);
  });
  it('does not let the run-out stand in for that outcome, since the timer can be Off', () => {
    expect(deceptionErrors(treeWith({ breaks: ['signs'] }, true))).toEqual(['hostage_crisis: the lie signs is never found out; add an outcome that breaks it']);
  });
  it('refuses a timeout that breaks a promise the call never makes', () => {
    expect(deceptionErrors(treeWith({ breaks: ['nothing'] }))).toContain('hostage_crisis: an outcome breaks nothing, which no outcome promises');
  });
});
