import { useRef, useState } from 'react';
import { DEV_NODES } from '../../content/dev-tree';
import type { Id } from '../../sim/types';
import { useToast } from '../components/toast';
import { unlockDevelopment } from '../store';
import { tierLabel } from '../../sim/development-tiers';

/** The persistence layer rechecks funding and atomically spends earned/test DP. */
export function useDevelopmentPurchase() {
  const { notify } = useToast();
  const busyRef = useRef(false);
  const [pendingNode, setPendingNode] = useState<Id | null>(null);
  const [failure, setFailure] = useState<{ nodeId: Id; reason: string } | null>(null);
  const purchase = async (nodeId: Id, expectedTier = 1, successMessage?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPendingNode(nodeId);
    setFailure(null);
    try {
      const result = await unlockDevelopment(nodeId, expectedTier);
      if (result.ok) notify(successMessage ?? `${DEV_NODES[nodeId]?.name ?? 'Development'} ${DEV_NODES[nodeId]?.tiers ? `tier ${tierLabel(expectedTier)} purchased` : 'unlocked'}`, { tone: 'ok' });
      else { setFailure({ nodeId, reason: result.reason }); notify(result.reason, { tone: 'error' }); }
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unable to save this unlock. Please try again.';
      setFailure({ nodeId, reason });
      notify(reason, { tone: 'error' });
    } finally {
      busyRef.current = false;
      setPendingNode(null);
    }
  };
  return { pendingNode, failure, purchase };
}
