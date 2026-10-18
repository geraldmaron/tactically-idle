// R-G4: a clock that runs out moves the call. The group fixture gets a clock on the courier whose
// `onOut.next` is a node nothing else reaches; a short choice that runs it out must land the call
// there, offer only that node's choices, and survive a save and load on the same node.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { Clock, IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import { actionViews } from '../../sim/operation-selectors';
import { traceRun } from '../../sim/operation';
import { deserialize, serialize } from '../../sim/save';
import { validExternalSupportState } from '../../sim/external-support';
import { getScenario } from '../../sim/scenario-registry';
import { NOW } from '../../sim/test-fixtures';
import type { GameState } from '../../sim/types';
import { applyNaturalMove, startGateRun, withDraftScenario } from './gates/engine-driver';
import { generateIncident } from './index';
import { compileIncident, drawInstance, hostedSpec } from './instance';
import { choiceActionId, clockRoute, memberCounts } from './trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

const same = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const CLOCK: Clock = { id: 'nerve', label: 'The courier’s nerve', kind: 'deadline', owner: 'courier', start: 30, ratePerMin: 5, rateKnown: false,
  cues: [{ at: 25, text: 'The courier keeps looking at the door.', mark: 'courier_restless' }],
  onOut: { mark: 'courier_bolts', next: { node: 'bolted' } } };

function template(next: Clock['onOut'] = CLOCK.onOut): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  tree.nodes.push({ id: 'bolted', stage: 'resolve', prompt: 'While the team waited on that, the courier ran for the door.',
    choices: [{ id: 'cover', title: 'Cover the door', summary: 'You cover the door while the courier runs.', preview: same('The courier gets out.'), icon: 'door', check: GROUP_TREE.nodes[0].choices[0].check, minutes: 2,
      outcomes: { favorable: [{ text: 'The courier is out.', safe: ['courier'], next: { ending: 'handed_over' } }], mixed: [{ text: 'The courier is out.', safe: ['courier'], next: { ending: 'handed_over' } }], adverse: [{ text: 'The courier is out.', safe: ['courier'], next: { ending: 'handed_over' } }] } }] });
  const clock = { ...CLOCK, ...(next ? { onOut: next } : {}) };
  if (!next) delete clock.onOut;
  return { ...GROUP_TEMPLATE, tree, situations: GROUP_TEMPLATE.situations.map(situation => ({ ...situation, clocks: [clock] })) };
}

function call(t: IncidentTemplate) {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      if ((memberCounts(drawInstance(t, built, spec).placed).others ?? 0) !== 0) continue;
      return compileIncident({ ...base, id: `clock-route-${seed}`, incident: spec }, built, t);
    } catch { continue; }
  }
  throw new Error('No seed draws a lone taker');
}

const id = (node: string, choice: string) => choiceActionId('hostage_crisis', node, choice);
/** Call the shop, then hold at the glass, on the dice the run draws (natural moves, so the waits
 * validator can re-derive every sample): every band of both goes on to the next node, the cue fires
 * in the first decision and the clock runs out in the second. */
function play(scenarioId: string): GameState {
  let state: GameState | null = startGateRun(scenarioId);
  state = applyNaturalMove(state, { kind: 'decide', actionId: id('open', 'call') });
  expect(state, 'the call').not.toBeNull();
  state = applyNaturalMove(state!, { kind: 'decide', actionId: id('talk', 'hold') });
  expect(state, 'the hold').not.toBeNull();
  return state!;
}
const offered = (state: GameState) => actionViews(state, NOW, 'A').filter(view => view.eligible).map(view => view.id).sort();

describe('a clock that runs out moves the call (R-G4)', () => {
  it('compiles the target into the clock’s route and keeps the node only the clock reaches', () => {
    const s = call(template());
    expect(s.clocks?.[0].onOut?.route).toMatchObject({ setFlags: ['tree:started', 'at:bolted'], stage: 'resolve' });
    expect(s.clocks?.[0].onOut?.route?.clearFlags).toContain('at:final');
    expect(Object.values(s.stages).flatMap(stage => stage.actions).map(action => action.id)).toContain(id('bolted', 'cover'));
  });

  it('prunes the node when no clock reaches it', () => {
    const s = call(template(null as unknown as Clock['onOut']));
    expect(Object.values(s.stages).flatMap(stage => stage.actions).map(action => action.id)).not.toContain(id('bolted', 'cover'));
  });

  it('rejects a target the tree doesn’t have', () => {
    expect(() => clockRoute(template().tree, { node: 'nowhere' }, 1)).toThrow(/a clock runs out to unknown node nowhere/);
    expect(() => clockRoute(template().tree, { ending: 'nowhere' }, 1)).toThrow(/a clock runs out to unknown ending nowhere/);
  });

  it('sends the call only on to the last stage or to an ending: never the root, never an earlier stage', () => {
    expect(() => clockRoute(template().tree, { node: 'open' }, 1)).toThrow(/not a resolve node/);
    expect(() => clockRoute(template().tree, { node: 'talk' }, 1)).toThrow(/not a resolve node/);
    expect(clockRoute(template().tree, { ending: 'all_out' }, 1)).toMatchObject({ ending: 'all_out' });
    expect(() => call(template({ mark: 'x', next: { node: 'talk' } }))).toThrow();
  });

  it('a short choice that runs it out lands the call on that node, after the outcome, with only its choices', () => {
    withDraftScenario(call(template()), scenarioId => {
      const state = play(scenarioId);
      const run = state.activeRun!;
      expect(run.clocks?.nerve.value).toBeLessThanOrEqual(0);
      expect(run.flags).toEqual(expect.arrayContaining(['at:bolted', 'mark:courier_bolts']));
      expect(run.flags).not.toContain('at:final');
      expect(run.stage).toBe('resolve');
      expect(offered(state)).toEqual([id('bolted', 'cover')]);
    });
  });

  it('a save and load mid-call, the decision replay and the waits replay all land on the same node', () => {
    withDraftScenario(call(template()), scenarioId => {
      const state = play(scenarioId);
      // The decision replay ends on the same node (sim/operation.ts traceRun).
      const replayed = traceRun(getScenario(scenarioId)!, state.activeRun!).end;
      expect(replayed.flags.filter(flag => flag.startsWith('at:'))).toEqual(['at:bolted']);
      // The waits path replays the public state the same way (sim/external-support.ts).
      expect(validExternalSupportState(state.activeRun!, getScenario(scenarioId)!)).toBe(true);
      // A draft call isn't on the board, so the save is checked without its card, as groups.test does.
      const copy = structuredClone(state);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      const back = deserialize(serialize(copy, NOW));
      expect(back, 'the save loads').not.toBeNull();
      expect(back!.activeRun!.flags.filter(flag => flag.startsWith('at:'))).toEqual(['at:bolted']);
      expect(back!.activeRun!.stage).toBe(state.activeRun!.stage);
      expect(offered(back!)).toEqual(offered(state));
    });
  });
});
