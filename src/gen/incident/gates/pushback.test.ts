// Push-back lines (docs/call-pressure.md): they fire once when the stall reaches their threshold,
// replay from the decision's recorded dither, stay silent without lines, and are never played in a
// situation that declares suicide_self_harm. Negative controls run on the group fixture this test owns.
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeThreat } from '../../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { buildLocation } from '../../../sim/location';
import { traceRun } from '../../../sim/operation';
import { actionViews } from '../../../sim/operation-selectors';
import { deserialize, serialize } from '../../../sim/save';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { getScenario } from '../../../sim/scenario-registry';
import { apply, NOW } from '../../../sim/test-fixtures';
import { generateIncident } from '../index';
import { compileIncident, hostedSpec } from '../instance';
import { choiceActionId } from '../trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from '../trees-v13/group-fixture';
import { startGateRun, withDraftScenario } from './engine-driver';
import { carriedPushback, pushbackDataFindings, pushbackFindings } from './pushback';

const THREAT: TreeThreat = {
  label: 'The courier edges for the door', minutes: 4, text: 'The courier takes a half step toward the street door.',
  pushback: [{ id: 'first', at: 1.5, by: 'taker', line: 'Test line from the taker.', mark: ['taker_pressed'] }, { id: 'second', at: 3, by: 'courier', line: 'Test line from the courier.' }],
};

function template(threat: TreeThreat | undefined, selfHarm: boolean): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  if (threat) tree.nodes.find(node => node.id === tree.root)!.threat = structuredClone(threat);
  tree.situations = tree.situations.map(situation => ({ ...situation, descriptors: selfHarm ? ['suicide_self_harm'] : [] })) as CallTree['situations'];
  return { ...GROUP_TEMPLATE, tree };
}

function compile(t: IncidentTemplate): ScenarioDefinition {
  for (let seed = 1; seed < 200; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base);
    try { return compileIncident({ ...base, id: `pushback-fixture-${seed}`, incident: spec }, buildLocation(base.locationFamilyId, base.locationSeed), t); } catch { continue; }
  }
  throw new Error('No seed hosts the fixture');
}

const rootChoice = (scenario: ScenarioDefinition) => scenario.stages.assess.actions.find(action => action.threat)!;

describe('the push-back gate', () => {
  it('passes every shipping call, and the hostage placeholder is stripped from every situation', () => {
    for (const t of Object.values(INCIDENT_TEMPLATES)) expect(pushbackFindings(t!), t!.type).toEqual([]);
    const hostage = INCIDENT_TEMPLATES.hostage_crisis!;
    expect(hostage.tree.nodes.some(node => node.threat?.pushback?.some(line => line.line.startsWith('PLACEHOLDER')))).toBe(true);
    expect(hostage.tree.situations.every(situation => situation.descriptors?.includes('suicide_self_harm'))).toBe(true);
  });

  it('fails a compiled self-harm situation that still carries lines (negative control)', () => {
    const t = template(THREAT, true);
    // The compiler strips them, so the gate passes; the same data in a situation without the theme
    // compiles with its lines, and the check the gate runs finds them.
    expect(pushbackFindings(t)).toEqual([]);
    expect(carriedPushback(compile(t))).toEqual([]);
    expect(carriedPushback(compile(template(THREAT, false))).length).toBeGreaterThan(0);
    expect(rootChoice(compile(template(THREAT, false))).threat!.pushback).toHaveLength(2);
  });

  it('holds a line to its rules', () => {
    const bad = (pushback: TreeThreat['pushback']) => pushbackDataFindings(template({ ...THREAT, pushback }, false).tree).map(finding => finding.message);
    expect(bad([{ id: 'a', at: 4, by: 'taker', line: 'x' }]).join()).toContain('below the threat');
    expect(bad([{ id: 'a', at: 0, by: 'taker', line: 'x' }]).join()).toContain('above 0');
    expect(bad([{ id: 'a', at: 1, by: 'nobody', line: 'x' }]).join()).toContain('no role or group');
    expect(bad([{ id: 'a', at: 1, by: 'taker', line: 'x' }, { id: 'a', at: 2, by: 'taker', line: 'y' }]).join()).toContain('unique id');
    expect(() => compile(template({ ...THREAT, pushback: [{ id: 'a', at: 5, by: 'taker', line: 'x' }] }, false))).toThrow();
  });
});

describe('a push-back line in play', () => {
  const s = compile(template(THREAT, false));
  const decide = (state: ReturnType<typeof startGateRun>, dither?: number) => {
    const view = actionViews(state, NOW, 'A').find(entry => entry.eligible)!;
    return apply(state, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds, ...(dither === undefined ? {} : { ditherMinutes: dither }) }).state;
  };
  const spoken = (state: ReturnType<typeof decide>) => (state.activeRun!.history.at(-1)!.committed?.exchange ?? []).map(line => line.line);

  it('fires the lines the stall reached, once, with their marks, and replays them', () => {
    withDraftScenario(s, sid => {
      const start = startGateRun(sid, 719);
      expect(choiceActionId('hostage_crisis', 'open', 'watch')).toBeTruthy();
      expect(spoken(decide(start))).toEqual([]);
      expect(spoken(decide(start, 1.4))).toEqual([]);
      const first = decide(start, 2);
      expect(spoken(first)).toEqual(['Test line from the taker.']);
      expect(first.activeRun!.flags).toContain('mark:taker_pressed');
      const both = decide(start, 4);
      expect(spoken(both)).toEqual(['Test line from the taker.', 'Test line from the courier.']);
      // Replay and reload read the recorded dither: the same flags, the same lines.
      const run = both.activeRun!, scenario = getScenario(sid)!;
      expect(traceRun(scenario, run).end.flags.sort()).toEqual([...run.flags].sort());
      const copy = structuredClone(both);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      const back = deserialize(serialize(copy, NOW))!;
      expect(back).not.toBeNull();
      expect(traceRun(scenario, back.activeRun!).end.flags.sort()).toEqual([...run.flags].sort());
    });
  });

  it('stays silent for a threat without lines, and in a self-harm situation', () => {
    for (const quiet of [template({ ...THREAT, pushback: undefined }, false), template(THREAT, true)]) withDraftScenario(compile(quiet), sid => {
      const after = decide(startGateRun(sid, 719), 4);
      expect(spoken(after)).toEqual([]);
      expect(after.activeRun!.flags).not.toContain('mark:taker_pressed');
    });
  });
});
