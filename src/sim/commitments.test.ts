import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { drawCalls, playToEnd, POLICIES } from '../gen/incident/trees-v13/balance';
import { applyCommitments, commitmentsMade } from './commitments';
import { METERS_V1 } from './meters';
import { deserialize, serialize } from './save';
import { getScenario } from './scenario-registry';
import type { ActionDefinition, IncidentPersonDef, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { DecisionResolution, GameState, OperationRun } from './types';

// M2 slice 4 (docs/incident-domain-model.md §2, D5): what command gives a person its word on is
// kept or broken by what the team does afterwards, by rule, never by authoring.

type Drawn = NonNullable<NonNullable<DecisionResolution['committed']>['drawn']>;
const subject: IncidentPersonDef = { id: 'taker', kind: 'subject', label: 'Ash', minor: false, spaceId: 'r1', at: { x: 0, y: 0 }, meters: { agitation: 50, rapport: 20 }, volatility: 'shifting' };
const scenario = { version: 13, incidentPeople: [subject] } as ScenarioDefinition;
const action = (patch: Partial<ActionDefinition> = {}): ActionDefinition => ({ id: 'act', talksTo: 'taker', ...patch } as ActionDefinition);
const concession = action({ id: 'write', authority: { kind: 'concession', item: 'statement' } });
const entry = action({ id: 'go_in', talksTo: undefined, authority: { kind: 'entry' } });
const run = (): Pick<OperationRun, 'flags' | 'clock' | 'revision' | 'meters' | 'commitments'> =>
  ({ flags: [], clock: 12, revision: 2, meters: { taker: { agitation: 50, rapport: 20, moved: {} } } });
const step = (r: ReturnType<typeof run>, a: ActionDefinition, band: 'favorable' | 'mixed' | 'adverse' = 'favorable', effects: OutcomeEffect[] = [], drawn: Drawn = [], flags: string[] = []) => {
  r.flags.push(...flags);
  const changed = applyCommitments(r, scenario, a, band, effects, drawn, r.revision);
  r.revision += 1;
  return changed;
};

describe('commitments: the rule', () => {
  it('are made by a promise on the outcome, or by an authorized concession that went well enough to give', () => {
    expect(commitmentsMade(action(), 'favorable', [{ promise: { id: 'back', personId: 'taker', kind: 'promise' } }])).toEqual([{ id: 'back', personId: 'taker', kind: 'promise' }]);
    expect(commitmentsMade(concession, 'favorable', [])).toEqual([{ id: 'concession:write', personId: 'taker', kind: 'statement' }]);
    expect(commitmentsMade(concession, 'mixed', [])).toHaveLength(1);
    expect(commitmentsMade(concession, 'adverse', [])).toEqual([]);
    expect(commitmentsMade(action({ talksTo: undefined, authority: { kind: 'concession', item: 'food' } }), 'favorable', [])).toEqual([]);
    expect(commitmentsMade(action(), 'favorable', [])).toEqual([]);
  });

  it('open when made, with the minute and the decision that made them', () => {
    const r = run();
    expect(step(r, concession)).toEqual([]);
    expect(r.commitments).toEqual({ 'concession:write': { personId: 'taker', kind: 'statement', madeAt: 12, revision: 2, status: 'open' } });
    step(r, concession);
    expect(Object.keys(r.commitments!)).toHaveLength(1);
  });

  it('break when the team goes in, and the subject hears it', () => {
    const r = run();
    step(r, concession);
    expect(step(r, entry)).toEqual([{ id: 'concession:write', status: 'broken' }]);
    expect(r.commitments!['concession:write'].status).toBe('broken');
    expect(r.meters!.taker.moved.promise_broken).toEqual(METERS_V1.events.promise_broken);
    // Broken stays broken, even when the subject then comes out.
    expect(step(r, action(), 'favorable', [], [], ['out:taker'])).toEqual([]);
  });

  it('break when the team uses force on that person, and only that person', () => {
    const r = run();
    step(r, action(), 'favorable', [{ promise: { id: 'a', personId: 'taker', kind: 'promise' } }, { promise: { id: 'b', personId: 'courier', kind: 'promise' } }]);
    expect(step(r, action(), 'adverse', [], [{ model: 'team_force', personId: 'taker', key: 'hands:none' }])).toEqual([{ id: 'a', status: 'broken' }]);
    expect(step(r, action(), 'adverse', [], [{ model: 'incoming_fire', personId: 'courier', key: 'none' }])).toEqual([]);
    expect(r.commitments!.b.status).toBe('open');
  });

  it('are kept when that person comes out while they stand, and the subject hears that too', () => {
    const r = run();
    step(r, concession);
    expect(step(r, action(), 'favorable', [], [], ['safe:courier'])).toEqual([]);
    expect(step(r, action(), 'favorable', [], [], ['out:taker'])).toEqual([{ id: 'concession:write', status: 'kept' }]);
    expect(r.meters!.taker.moved.promise_kept).toEqual(METERS_V1.events.promise_kept);
    expect(step(r, entry)).toEqual([]);
    expect(r.commitments!['concession:write'].status).toBe('kept');
  });

  it('made and kept in one decision when the concession brings the person out', () => {
    const r = run();
    expect(step(r, concession, 'mixed', [], [], ['out:taker'])).toEqual([{ id: 'concession:write', status: 'kept' }]);
  });

  it('do nothing before v13, and give the same result every time', () => {
    const old = run();
    expect(applyCommitments(old, { ...scenario, version: 12 }, concession, 'favorable', [], [], 0)).toEqual([]);
    expect(old.commitments).toBeUndefined();
    const a = run(), b = run();
    for (const r of [a, b]) { step(r, concession); step(r, entry); }
    expect(a).toEqual(b);
  });
});

describe('commitments in play', () => {
  const runs: GameState[] = [];
  for (const type of Object.keys(CALL_TREES) as (keyof typeof CALL_TREES)[])
    for (const { scenarioId, seed } of drawCalls(CALL_TREES[type]!, 2, 12)) for (const policy of POLICIES) runs.push(playToEnd(scenarioId, policy, seed));

  it('follow the rule on every played call, and every save stays valid', () => {
    let made = 0;
    const seen = { kept: 0, broken: 0, open: 0 };
    for (const state of runs) {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      const actions = new Map(Object.values(scenario.stages).flatMap(stage => stage.actions).map(entry => [entry.id, entry]));
      for (const commitment of Object.values(run.commitments ?? {})) {
        made++;
        seen[commitment.status]++;
        const after = run.history.filter(decision => decision.revision >= commitment.revision);
        const entered = after.some(decision => actions.get(decision.actionId)?.authority?.kind === 'entry');
        const forced = after.some(decision => decision.committed?.drawn?.some(record => record.model === 'team_force' && record.personId === commitment.personId));
        const out = run.flags.includes(`out:${commitment.personId}`) || run.flags.includes(`safe:${commitment.personId}`);
        if (commitment.status === 'broken') expect(entered || forced).toBe(true);
        if (commitment.status === 'kept') expect(out).toBe(true);
        if (commitment.status === 'open') expect(out || entered || forced).toBe(false);
        if (commitment.status !== 'open' && run.meters?.[commitment.personId]) expect(run.meters[commitment.personId].moved[commitment.status === 'kept' ? 'promise_kept' : 'promise_broken']).toBeDefined();
      }
      // Every run must load, gunfire and force included (their draws are counted on load).
      expect(deserialize(serialize(state, 1)), run.scenarioId).not.toBeNull();
    }
    expect(made).toBeGreaterThan(0);
    expect(seen.kept).toBeGreaterThan(0);
  });
});
