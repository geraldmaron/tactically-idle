// Two jobs that need no screen: the grant celebration and the entitlement sync.
// The grant celebration (develop-grants): when a milestone grants a development, a toast names it
// and the milestone, and opens it in Develop. The shift report keeps the same line. Grants already
// on record when the game opens are not announced again.
import { useEffect, useRef } from 'react';
import { entitlementsFrom, useLedger } from '../entitlements';
import { send, useGame } from '../store';
import { useNav } from './nav';
import { useToast } from './toast';
import { grantName } from './ShiftReport';

/** Keeps the department's lifetime entitlements equal to the ledger (ui/entitlements.ts): on load, on a
 * new campaign (this mounts with the shell), and after any purchase, restore or refund. The platform is
 * the authority; the save only carries what it last said. */
function useEntitlementSync(): void {
  const g = useGame();
  const ledger = useLedger();
  const next = entitlementsFrom(ledger.owned);
  const held = g.department.entitlements;
  const same = !!held && held.charter === next.charter && held.nightWatch === next.nightWatch;
  const { charter, nightWatch } = next;
  useEffect(() => {
    if (!same) send({ type: 'syncEntitlements', entitlements: { charter, nightWatch } });
  }, [same, charter, nightWatch]);
}

export function GrantToasts() {
  useEntitlementSync();
  const g = useGame();
  const nav = useNav();
  const { notify } = useToast();
  const grants = g.department.grants;
  const seen = useRef(grants.length);
  useEffect(() => {
    if (grants.length < seen.current) seen.current = grants.length;
    if (grants.length === seen.current) return;
    const fresh = grants.slice(seen.current);
    seen.current = grants.length;
    const first = fresh[0];
    notify(fresh.length === 1 ? `${grantName(first)} granted` : `${fresh.length} developments granted`, {
      tone: 'ok',
      lines: fresh.length === 1 ? [`Reached ${first.milestone}. Free, and already active.`] : fresh.map((grant) => `${grantName(grant)}, at ${grant.milestone}`),
      onSelect: () => nav.openDevelopment(first.nodeId),
    });
  }, [grants, notify, nav]);
  return null;
}
