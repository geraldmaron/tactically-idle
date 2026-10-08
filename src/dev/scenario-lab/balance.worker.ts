// Runs the balance simulator (gen/incident/trees-v13/balance.ts) off the main thread for the lab.
// The same function the balance gate runs, so the lab and `call-tree-balance.test.ts` agree.
import { CALL_TREES } from '../../content/call-trees';
import { measure } from '../../gen/incident/trees-v13/balance';
import type { Policy } from '../../gen/incident/trees-v13/balance';
import type { IncidentType } from '../../sim/scenario-types';

export interface BalanceRequest { type: IncidentType; tier: number; policies: Policy[]; calls: number }

const scope = self as unknown as { onmessage: ((event: MessageEvent<BalanceRequest>) => void) | null; postMessage: (message: unknown) => void };
scope.onmessage = event => {
  const { type, tier, policies, calls } = event.data;
  const tree = CALL_TREES[type];
  if (!tree) { scope.postMessage({ error: `No call tree for ${type}` }); return; }
  for (const policy of policies) {
    try { scope.postMessage({ policy, distribution: measure(tree, tier, policy, calls) }); }
    catch (error) { scope.postMessage({ policy, error: String(error) }); }
  }
  scope.postMessage({ done: true });
};
