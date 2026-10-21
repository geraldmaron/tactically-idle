// The grant celebration (develop-grants): when a milestone grants a development, a toast names it
// and the milestone, and opens it in Develop. The shift report keeps the same line. Grants already
// on record when the game opens are not announced again.
import { useEffect, useRef } from 'react';
import { useGame } from '../store';
import { useNav } from './nav';
import { useToast } from './toast';
import { grantName } from './ShiftReport';

export function GrantToasts() {
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
