// moves-skip-pruned: a move on a choice or an outcome this call prunes (onlyIf, when) compiles to
// nothing. Before, withCallTree numbered moves over every choice of the reachable nodes, so a pruned
// one left a transition on a flag nothing sets, and validateStoryBindings refused the call
// ("references undeclared flag moved:subject:21"). On the group fixture drawn with the taker alone,
// with a choice and a line behind a mark nothing in the call sets.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { movedFlag } from '../../sim/conditions';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { generateIncident } from './index';
import { compileIncident, drawInstance, hostedSpec } from './instance';
import { choiceActionId, memberCounts } from './trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

const TO_DOOR = { doorOf: 'taker' } as const;

/** The fixture with the courier moved by the opening call's favorable line (kept); by a line on it
 * that needs a mark nothing in the call sets (pruned by when); and by every band of a choice at
 * `talk` offered only behind that mark (pruned by onlyIf). Pruning by count happens earlier, in
 * treeForCounts; these are the prunes the moves loop has to skip itself. */
const NEVER = 'courier_trusts_taker';
function template(): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const open = tree.nodes.find(node => node.id === 'open')!.choices.find(choice => choice.id === 'call')!;
  open.outcomes.favorable[0].moveTo = { courier: TO_DOOR };
  open.outcomes.favorable.push({ when: { marks: [NEVER] }, text: 'The courier steps back to the counter.', moveTo: { courier: 'scene' } });
  const talk = tree.nodes.find(node => node.id === 'talk')!;
  const hold = talk.choices.find(choice => choice.id === 'hold')!;
  const behind = structuredClone(hold);
  behind.id = 'ask_courier';
  behind.onlyIf = { marks: [NEVER] };
  for (const band of ['favorable', 'mixed', 'adverse'] as const) for (const outcome of behind.outcomes[band]) outcome.moveTo = { courier: 'scene' };
  talk.choices.push(behind);
  return { ...GROUP_TEMPLATE, tree };
}

/** The first call seed whose draw gives a lone taker, compiled (or the compile error). */
function lone(t: IncidentTemplate) {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    let others;
    try { others = memberCounts(drawInstance(GROUP_TEMPLATE, built, spec).placed).others ?? 0; } catch { continue; }
    if (others !== 0) continue;
    return { built, compile: () => compileIncident({ ...base, id: `moves-pruned-${seed}`, incident: spec }, built, t) };
  }
  throw new Error('No seed draws a lone taker');
}

describe('a move on a pruned choice or outcome compiles to nothing (moves-skip-pruned)', () => {
  const call = lone(template());

  it('the call compiles and validates, with only the kept move in the courier’s story', () => {
    const s = call.compile();
    expect(validateScenario(s, call.built)).toEqual([]);
    const actions = Object.values(s.stages).flatMap(stage => stage.actions);
    expect(actions.some(action => action.id === choiceActionId('hostage_crisis', 'talk', 'ask_courier')), 'ask_courier is pruned').toBe(false);
    const moves = s.story!.bindings.people.courier.transitions.filter(entry => entry.when.flags?.some(flag => flag.startsWith('moved:')));
    expect(moves.map(entry => entry.when.flags)).toEqual([[movedFlag('courier', 1)]]);
    const call1 = actions.find(action => action.id === choiceActionId('hostage_crisis', 'open', 'call'))!;
    expect(call1.outcomes.favorable.some(effect => effect.setFlags?.includes(movedFlag('courier', 1)))).toBe(true);
  });
});
