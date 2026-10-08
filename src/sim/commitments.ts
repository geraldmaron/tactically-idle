// Commitments for v13 incidents (docs/incident-domain-model.md §2, decision D5). When command gives a
// person its word, the run remembers it, and what the team does afterwards keeps it or breaks it.
// Nobody authors the result: the rule reads what the team did.
//
// - Made when a committed outcome carries a promise, or when an authorized concession choice (a
//   statement, a message, surrender terms) commits on a favorable or mixed result.
// - Broken if, while it is open, the team takes an entry choice, or uses force on that person.
// - Kept when that person comes out while it is open.
// - Still open at the end of the call stays open.
//
// Kept and broken move that person's meters (promise_kept, promise_broken in sim/meters.ts) and
// count in the call's score (sim/outcome-score.ts). Deterministic: it reads the decision, never dice.
import { applyMoves } from './meters';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { DecisionResolution, Id, OperationRun, OutcomeBand } from './types';

export type Commitment = NonNullable<OperationRun['commitments']>[Id];
type DrawnRecord = NonNullable<NonNullable<DecisionResolution['committed']>['drawn']>[number];
type CommitmentRun = Pick<OperationRun, 'flags' | 'clock' | 'revision' | 'meters'> & Partial<Pick<OperationRun, 'commitments'>>;

/** The commitments a decision makes: each promise its outcome carries, else the concession it
 * asked command for, when it went well enough to give. */
export function commitmentsMade(action: ActionDefinition, band: OutcomeBand, effects: readonly OutcomeEffect[]): { id: Id; personId: Id; kind: string }[] {
  const promised = effects.flatMap(effect => effect.promise ? [{ id: effect.promise.id, personId: effect.promise.personId, kind: effect.promise.kind }] : []);
  if (promised.length) return promised;
  const person = action.talksTo ?? action.storyTargetPersonId;
  if (action.authority?.kind === 'concession' && band !== 'adverse' && person) return [{ id: `concession:${action.id}`, personId: person, kind: action.authority.item }];
  return [];
}

const isOut = (run: Pick<OperationRun, 'flags'>, personId: Id) => run.flags.includes(`out:${personId}`) || run.flags.includes(`safe:${personId}`);

/** Apply one committed decision to the run's commitments, after its matched effects have applied
 * (so `out:` and `safe:` flags are current). `revision` is the decision's own revision. Returns the
 * commitments that changed status, in order. */
export function applyCommitments(run: CommitmentRun, scenario: ScenarioDefinition, action: ActionDefinition, band: OutcomeBand,
  effects: readonly OutcomeEffect[], drawn: readonly DrawnRecord[], revision: number): { id: Id; status: 'kept' | 'broken' }[] {
  if (scenario.version < 13) return [];
  for (const made of commitmentsMade(action, band, effects)) {
    if (run.commitments?.[made.id]) continue;
    run.commitments = { ...run.commitments, [made.id]: { personId: made.personId, kind: made.kind, madeAt: run.clock, revision, status: 'open' } };
  }
  if (!run.commitments) return [];
  const entry = action.authority?.kind === 'entry';
  const forced = new Set(drawn.filter(record => record.model === 'team_force').map(record => record.personId));
  const changed: { id: Id; status: 'kept' | 'broken' }[] = [];
  for (const [id, commitment] of Object.entries(run.commitments)) {
    if (commitment.status !== 'open') continue;
    const status = entry || forced.has(commitment.personId) ? 'broken' : isOut(run, commitment.personId) ? 'kept' : null;
    if (!status) continue;
    run.commitments = { ...run.commitments, [id]: { ...commitment, status } };
    changed.push({ id, status });
  }
  if (changed.length) applyMoves(run, scenario, changed.map(({ id, status }) => ({ moves: [{ personId: run.commitments![id].personId, event: status === 'kept' ? 'promise_kept' as const : 'promise_broken' as const }] })));
  return changed;
}
